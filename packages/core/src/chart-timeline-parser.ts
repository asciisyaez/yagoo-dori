export const TIMELINE_NOTE_TYPES = [
  "normal",
  "flick",
  "long-start",
  "long-end",
  "long-flick-end",
  "long-continuation",
  "long-relay",
  "damage",
] as const;

export type TimelineNoteType = (typeof TIMELINE_NOTE_TYPES)[number];

export const TIMELINE_NOTE_TYPE_CODES = Object.fromEntries(
  TIMELINE_NOTE_TYPES.map((type, index) => [type, index]),
) as Record<TimelineNoteType, number>;

export type ParsedTimelineEvent = {
  atMicroseconds: number;
  noteType: TimelineNoteType;
  critical: boolean;
};

export type ParsedChartTimeline = {
  musicId: string;
  waveOffsetMicroseconds: number;
  events: ParsedTimelineEvent[];
  specialMarkerMicroseconds: number[];
  feverMarkerMicroseconds: {
    chargeStart: number;
    chargeEnd: number;
    feverStart: number;
    feverEnd: number;
  } | null;
  declaredCounts: Record<TimelineNoteType, number>;
  declaredFullCombo: number;
};

type Bar = { measure: number; ticksPerMeasure: number; startTick: number };
type SusNote = { tick: number; lane: number; width: number; kind: number };

const TICKS_PER_BEAT = 480;

const DECLARED_COUNT_KEYS: Record<string, TimelineNoteType> = {
  NORMAL_NOTE_COUNT: "normal",
  FLICK_NOTE_COUNT: "flick",
  LONG_START_NOTE_COUNT: "long-start",
  LONG_END_NOTE_COUNT: "long-end",
  LONG_FLICK_END_NOTE_COUNT: "long-flick-end",
  LONG_CONTINUE_NOTE_COUNT: "long-continuation",
  LONG_RELAY_NOTE_COUNT: "long-relay",
  DAMAGE_NOTE_COUNT: "damage",
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function charToInt(character: string): number {
  assert(character.length === 1, `Expected one base62 character, received ${character}`);
  const code = character.charCodeAt(0);
  if (code >= 48 && code <= 57) return code - 48;
  if (code >= 97 && code <= 122) return code - 87;
  if (code >= 65 && code <= 90) return code - 29;
  throw new Error(`Invalid base62 character ${character}`);
}

function parseCompressedCells(data: string): { position: number; cell: string; total: number }[] {
  const cells: Array<{ position: number; cell: string }> = [];
  let index = 0;
  let position = 0;
  const compact = data.trim();
  while (index < compact.length) {
    if (index + 4 <= compact.length && compact[index] === "0" && compact[index + 1] === "x") {
      position += charToInt(compact[index + 2]!) * 62 + charToInt(compact[index + 3]!);
      index += 4;
      continue;
    }
    assert(index + 2 <= compact.length, `Truncated SUS cell in ${data}`);
    const cell = compact.slice(index, index + 2);
    if (cell !== "00") cells.push({ position, cell });
    position += 1;
    index += 2;
  }
  assert(position > 0, `Empty SUS grid ${data}`);
  return cells.map((cell) => ({ ...cell, total: position }));
}

function buildBars(lengths: Array<{ measure: number; lengthBeats: number }>): Bar[] {
  const normalized = [...lengths].sort((left, right) => left.measure - right.measure);
  if (normalized.length === 0 || normalized[0]!.measure !== 0) {
    normalized.unshift({ measure: 0, lengthBeats: 4 });
  }
  const bars: Bar[] = [];
  let startTick = 0;
  let previous: { measure: number; lengthBeats: number } | undefined;
  for (const entry of normalized) {
    if (previous) {
      startTick +=
        (entry.measure - previous.measure) * Math.trunc(previous.lengthBeats * TICKS_PER_BEAT);
    }
    bars.push({
      measure: entry.measure,
      ticksPerMeasure: Math.trunc(entry.lengthBeats * TICKS_PER_BEAT),
      startTick,
    });
    previous = entry;
  }
  return bars;
}

function tickAt(bars: Bar[], measure: number, position: number, total: number): number {
  let bar = bars[0]!;
  for (const candidate of bars) {
    if (candidate.measure > measure) break;
    bar = candidate;
  }
  const measureStart = bar.startTick + (measure - bar.measure) * bar.ticksPerMeasure;
  return measureStart + Math.floor((position * bar.ticksPerMeasure) / total);
}

function parseNoteGrid(
  data: string,
  bars: Bar[],
  measure: number,
  laneCharacter: string,
): SusNote[] {
  const lane = charToInt(laneCharacter);
  return parseCompressedCells(data).map(({ position, cell, total }) => ({
    tick: tickAt(bars, measure, position, total),
    lane,
    kind: charToInt(cell[0]!),
    width: charToInt(cell[1]!),
  }));
}

function noteKey(note: Pick<SusNote, "tick" | "lane">): string {
  return `${note.tick}:${note.lane}`;
}

function microsecondsAt(tick: number, bpmChanges: Array<{ tick: number; bpm: number }>): number {
  let elapsedSeconds = 0;
  let previousTick = 0;
  let previousBpm = bpmChanges[0]?.bpm ?? 120;
  for (const change of bpmChanges) {
    if (change.tick > tick) break;
    elapsedSeconds += (((change.tick - previousTick) / TICKS_PER_BEAT) * 60) / previousBpm;
    previousTick = change.tick;
    previousBpm = change.bpm;
  }
  elapsedSeconds += (((tick - previousTick) / TICKS_PER_BEAT) * 60) / previousBpm;
  return Math.round(elapsedSeconds * 1_000_000);
}

function groupSlides(streams: Map<number, SusNote[]>): SusNote[][] {
  const slides: SusNote[][] = [];
  for (const stream of streams.values()) {
    const seen = new Set<string>();
    const notes = [...stream]
      .sort((left, right) => left.tick - right.tick || left.lane - right.lane || left.kind - right.kind)
      .filter((note) => {
        const key = `${noteKey(note)}:${note.kind}:${note.width}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    const starts: SusNote[] = [];
    const relays: SusNote[] = [];
    for (const note of notes) {
      if (note.kind === 1) {
        starts.push(note);
      } else if (note.kind === 2) {
        const startIndex = starts.findIndex((start) => start.tick <= note.tick);
        if (startIndex < 0) continue;
        const start = starts.splice(startIndex, 1)[0]!;
        const matchingRelays = relays.filter(
          (relay) => relay.tick >= start.tick && relay.tick <= note.tick,
        );
        for (const relay of matchingRelays) relays.splice(relays.indexOf(relay), 1);
        slides.push([start, ...matchingRelays.sort((a, b) => a.tick - b.tick), note]);
      } else {
        relays.push(note);
      }
    }
  }
  return slides;
}

function emptyCounts(): Record<TimelineNoteType, number> {
  return Object.fromEntries(TIMELINE_NOTE_TYPES.map((type) => [type, 0])) as Record<
    TimelineNoteType,
    number
  >;
}

export function parseHolodoriSus(input: string): ParsedChartTimeline {
  const lines = input.split(/\r?\n/).map((line) => line.trim());
  const directives = new Map<string, string>();
  const declaredCounts = emptyCounts();
  const barLengths: Array<{ measure: number; lengthBeats: number }> = [];

  for (const line of lines) {
    if (!line.startsWith("#")) continue;
    const colon = line.indexOf(":", 1);
    if (colon >= 0) {
      const header = line.slice(1, colon).trim();
      if (/^\d{3}02$/.test(header)) {
        barLengths.push({ measure: Number(header.slice(0, 3)), lengthBeats: Number(line.slice(colon + 1)) });
      }
      continue;
    }
    const match = /^#([A-Z0-9_]+)\s+(.+)$/.exec(line);
    if (!match) continue;
    const key = match[1]!;
    const value = match[2]!.trim().replace(/^"|"$/g, "");
    directives.set(key, value);
    const noteType = DECLARED_COUNT_KEYS[key];
    if (noteType) declaredCounts[noteType] = Number(value);
  }

  const musicId = directives.get("MUSIC_ID") ?? "";
  assert(/^m\d{4}$/.test(musicId), `Missing or invalid MUSIC_ID: ${musicId}`);
  const declaredFullCombo = Number(directives.get("FULL_COMBO_NOTE_COUNT"));
  assert(Number.isInteger(declaredFullCombo), `Missing FULL_COMBO_NOTE_COUNT for ${musicId}`);
  const waveOffsetMicroseconds = Math.round(Number(directives.get("WAVEOFFSET") ?? 0) * 1_000_000);
  const baseBpm = Number(directives.get("BASEBPM") ?? 120);
  assert(Number.isFinite(baseBpm) && baseBpm > 0, `Invalid BASEBPM for ${musicId}`);

  const bars = buildBars(barLengths);
  const bpmDefinitions = new Map<string, number>();
  const bpmChanges: Array<{ tick: number; bpm: number }> = [];
  const specialPoints: Array<{ tick: number; slot: number }> = [];
  const feverPoints = new Map<string, number[]>();
  const taps: SusNote[] = [];
  const directionals: SusNote[] = [];
  const slideStreams = new Map<number, SusNote[]>();

  for (const line of lines) {
    if (!line.startsWith("#")) continue;
    const colon = line.indexOf(":", 1);
    if (colon < 0) continue;
    const header = line.slice(1, colon).trim();
    const data = line.slice(colon + 1).trim();
    if (/^BPM[0-9A-Za-z]{2}$/.test(header)) {
      bpmDefinitions.set(header.slice(3), Number(data));
      continue;
    }
    if (!/^\d{3}[0-9A-Za-z]{2,3}$/.test(header)) continue;
    const measure = Number(header.slice(0, 3));
    const event = header[3]!;
    const laneCharacter = header[4]!;
    if (header.length === 5 && header.slice(3) === "08") {
      for (const { position, cell, total } of parseCompressedCells(data)) {
        bpmChanges.push({ tick: tickAt(bars, measure, position, total), bpm: bpmDefinitions.get(cell) ?? baseBpm });
      }
    } else if (header.length === 5 && header.slice(3) === "0B") {
      for (const { position, cell, total } of parseCompressedCells(data)) {
        specialPoints.push({
          tick: tickAt(bars, measure, position, total),
          slot: charToInt(cell[0]!) * 62 + charToInt(cell[1]!),
        });
      }
    } else if (header.length === 5 && (header.slice(3) === "0C" || header.slice(3) === "0D")) {
      for (const { position, cell, total } of parseCompressedCells(data)) {
        const value = charToInt(cell[0]!) * 62 + charToInt(cell[1]!);
        const point = header.slice(3) === "0C"
          ? value === 1 ? "chargeStart" : value === 2 ? "chargeEnd" : null
          : value === 1 ? "feverStart" : value === 2 ? "feverEnd" : null;
        if (point) (feverPoints.get(point) ?? feverPoints.set(point, []).get(point)!).push(
          tickAt(bars, measure, position, total),
        );
      }
    } else if (event === "1" && header.length === 5) {
      taps.push(...parseNoteGrid(data, bars, measure, laneCharacter));
    } else if (event === "5" && header.length === 5) {
      directionals.push(...parseNoteGrid(data, bars, measure, laneCharacter));
    } else if (event === "3" && header.length === 6) {
      const channel = charToInt(header[5]!);
      const stream = slideStreams.get(channel) ?? [];
      stream.push(...parseNoteGrid(data, bars, measure, laneCharacter));
      slideStreams.set(channel, stream);
    }
  }

  if (bpmChanges.length === 0 || bpmChanges.every((change) => change.tick !== 0)) {
    bpmChanges.push({ tick: 0, bpm: baseBpm });
  }
  bpmChanges.sort((left, right) => left.tick - right.tick);

  const slides = groupSlides(slideStreams);
  const slideStartKeys = new Set(slides.map((slide) => noteKey(slide[0]!)));
  const slideEndKeys = new Set(slides.map((slide) => noteKey(slide.at(-1)!)));
  const tapKeys = new Set(taps.filter((note) => note.kind === 1).map(noteKey));
  const criticalKeys = new Set(taps.filter((note) => note.kind === 2 || note.kind === 6).map(noteKey));
  const flickByKey = new Set(
    directionals.filter((note) => note.kind === 1 || note.kind === 3 || note.kind === 4).map(noteKey),
  );
  const eventsByTick: Array<{ tick: number; noteType: TimelineNoteType; critical: boolean }> = [];

  for (const note of taps) {
    if (note.kind !== 1) continue;
    const key = noteKey(note);
    if (slideStartKeys.has(key)) continue;
    eventsByTick.push({
      tick: note.tick,
      noteType: flickByKey.has(key) ? "flick" : "normal",
      critical: criticalKeys.has(key),
    });
  }
  for (const note of directionals) {
    if (![1, 3, 4].includes(note.kind)) continue;
    const key = noteKey(note);
    if (tapKeys.has(key) || slideStartKeys.has(key) || slideEndKeys.has(key)) continue;
    eventsByTick.push({ tick: note.tick, noteType: "flick", critical: criticalKeys.has(key) });
  }
  for (const note of taps) {
    if (note.kind !== 2) continue;
    const key = noteKey(note);
    if (tapKeys.has(key) || flickByKey.has(key) || slideStartKeys.has(key) || slideEndKeys.has(key)) continue;
    eventsByTick.push({ tick: note.tick, noteType: "normal", critical: true });
  }
  for (const slide of slides) {
    if (slide.length < 2) continue;
    const start = slide[0]!;
    const end = slide.at(-1)!;
    const critical = criticalKeys.has(noteKey(start));
    eventsByTick.push({ tick: start.tick, noteType: "long-start", critical });
    for (const relay of slide.slice(1, -1)) {
      if (relay.kind === 3) {
        eventsByTick.push({ tick: relay.tick, noteType: "long-relay", critical });
      }
    }
    const flickEnd = flickByKey.has(noteKey(end));
    eventsByTick.push({
      tick: end.tick,
      noteType: flickEnd ? "long-flick-end" : "long-end",
      critical: critical || criticalKeys.has(noteKey(end)),
    });
    for (
      let tick = Math.floor(start.tick / (TICKS_PER_BEAT / 2)) * (TICKS_PER_BEAT / 2) + TICKS_PER_BEAT / 2;
      tick < end.tick;
      tick += TICKS_PER_BEAT / 2
    ) {
      eventsByTick.push({ tick, noteType: "long-continuation", critical });
    }
  }

  const events = eventsByTick
    .map((event) => ({
      atMicroseconds: microsecondsAt(event.tick, bpmChanges),
      noteType: event.noteType,
      critical: event.critical,
    }))
    .sort(
      (left, right) =>
        left.atMicroseconds - right.atMicroseconds ||
        TIMELINE_NOTE_TYPE_CODES[left.noteType] - TIMELINE_NOTE_TYPE_CODES[right.noteType] ||
        Number(left.critical) - Number(right.critical),
    );

  const specialBySlot = new Map(
    specialPoints.map((point) => [point.slot, microsecondsAt(point.tick, bpmChanges)]),
  );
  const specialMarkerMicroseconds = [...specialBySlot.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, timestamp]) => timestamp);

  const feverOrder = ["chargeStart", "chargeEnd", "feverStart", "feverEnd"] as const;
  const feverValues = feverOrder.map((key) => feverPoints.get(key));
  const feverMarkerMicroseconds = feverValues.every((points) => points?.length === 1)
    ? {
        chargeStart: microsecondsAt(feverValues[0]![0]!, bpmChanges),
        chargeEnd: microsecondsAt(feverValues[1]![0]!, bpmChanges),
        feverStart: microsecondsAt(feverValues[2]![0]!, bpmChanges),
        feverEnd: microsecondsAt(feverValues[3]![0]!, bpmChanges),
      }
    : null;

  return {
    musicId,
    waveOffsetMicroseconds,
    events,
    specialMarkerMicroseconds,
    feverMarkerMicroseconds,
    declaredCounts,
    declaredFullCombo,
  };
}

export function countTimelineEvents(
  events: readonly ParsedTimelineEvent[],
): Record<TimelineNoteType, number> {
  const counts = emptyCounts();
  for (const event of events) counts[event.noteType] += 1;
  return counts;
}
