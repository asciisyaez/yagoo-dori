const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseIsoCalendarDate(value: string): number | null {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];

  if (!daysInMonth || day < 1 || day > daysInMonth) return null;
  return Date.UTC(year, month - 1, day);
}

// The oldest firstSeenAt in the dataset is the tracking BASELINE: those
// stamps were backfilled when tracking began (upstream publishes no card
// release dates), so the baseline wave is never "new". Only cards first seen
// strictly after it, within 30 days of the snapshot's retrievedAt, qualify.
// Both dates come from the pinned snapshot, never wall-clock, so the static
// export stays deterministic.
export function trackingBaseline(firstSeenDates: readonly string[]): string | null {
  let baseline: string | null = null;
  for (const value of firstSeenDates) {
    if (parseIsoCalendarDate(value) === null) continue;
    if (baseline === null || value < baseline) baseline = value;
  }
  return baseline;
}

export function isCardRecentlyAdded(
  firstSeenAt: string,
  retrievedAt: string,
  baseline: string | null,
): boolean {
  if (baseline === null || firstSeenAt <= baseline) return false;
  const firstSeenTimestamp = parseIsoCalendarDate(firstSeenAt);
  const retrievedTimestamp = parseIsoCalendarDate(retrievedAt);
  if (firstSeenTimestamp === null || retrievedTimestamp === null) return false;

  const age = retrievedTimestamp - firstSeenTimestamp;
  return age >= 0 && age <= 30 * MILLISECONDS_PER_DAY;
}
