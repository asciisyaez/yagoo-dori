import {
  memberTierForIndex,
  modelBandForIndex,
  nativeMemberTierCalibration,
  nativeRankingData,
  publicData,
} from "@yagoo-dori/core";
import type { Metadata } from "next";
import { SiteLink as Link } from "@/components/site-link";
import { ArrowRight, Sigma } from "lucide-react";

export const metadata: Metadata = {
  title: "Tier-list methodology",
  description:
    "The complete measurement pipeline behind the Yagoo-dori tier list: the team utility model, matched substitution, the four card metrics, the index scale, and the tier boundaries.",
};

type Lens = (typeof nativeRankingData.lenses)[number];
type Entry = Lens["entries"][number];

const memberLenses = nativeRankingData.lenses;
const leaderLenses = nativeRankingData.leaderOutfitLenses;
const lensCount = memberLenses.length + leaderLenses.length;

const lensKey = (id: string) =>
  id.replace(/^(member|leader-outfit)-manual-ap-/, "") as keyof typeof nativeMemberTierCalibration.lenses;

/**
 * The published tier is the raw index band after an evidence gate that can only
 * demote. Recomputing the ungated band here keeps the "nothing reaches SS or D"
 * claim below bound to the data instead of to a number typed into prose.
 */
function ungatedBand(entityKind: "member" | "leader", lensId: string, entry: Entry) {
  return entityKind === "member"
    ? memberTierForIndex(lensKey(lensId), entry.index.central)
    : modelBandForIndex(entry.index.central);
}

const allRows = [
  ...memberLenses.flatMap((lens) =>
    lens.entries.map((entry) => ({ entityKind: "member" as const, lensId: lens.id, entry })),
  ),
  ...leaderLenses.flatMap((lens) =>
    lens.entries.map((entry) => ({ entityKind: "leader" as const, lensId: lens.id, entry })),
  ),
];

const gateEffect = allRows.reduce(
  (totals, row) => {
    const raw = ungatedBand(row.entityKind, row.lensId, row.entry);
    if (raw === "SS") totals.rawSS += 1;
    if (raw === "D") totals.rawD += 1;
    if (row.entry.tier === "SS") totals.publishedSS += 1;
    if (row.entry.tier === "D") totals.publishedD += 1;
    return totals;
  },
  { rawSS: 0, rawD: 0, publishedSS: 0, publishedD: 0 },
);

const intervalWidths = allRows
  .map((row) => row.entry.index.upper - row.entry.index.lower)
  .sort((left, right) => left - right);
const medianIntervalWidth = intervalWidths[Math.floor(intervalWidths.length / 2)] ?? 0;

const highestCentralIndex = Math.max(...allRows.map((row) => row.entry.index.central));

/** Cards whose published tier is not the same on every lens of their entity kind. */
function tierDisagreementCount(lenses: readonly Lens[]): number {
  const tiersByCard = new Map<string, Set<string>>();
  for (const lens of lenses) {
    for (const entry of lens.entries) {
      const tiers = tiersByCard.get(entry.cardId) ?? new Set<string>();
      tiers.add(entry.tier);
      tiersByCard.set(entry.cardId, tiers);
    }
  }
  return [...tiersByCard.values()].filter((tiers) => tiers.size > 1).length;
}

const memberLensDisagreements = tierDisagreementCount(memberLenses);
const leaderLensDisagreements = tierDisagreementCount(leaderLenses);

const memberMatchedContexts = memberLenses[0]!.entries.map(
  (entry) => entry.evaluation.matchedContexts,
);
const memberContextRange = {
  min: Math.min(...memberMatchedContexts),
  max: Math.max(...memberMatchedContexts),
};
const leaderMatchedContexts = leaderLenses[0]!.entries.map(
  (entry) => entry.evaluation.matchedContexts,
);
const leaderContextCount = Math.max(...leaderMatchedContexts);
const comparisonCohortSize = memberLenses[0]!.entries[0]!.evaluation.frozenComparisonCohortSize;
const bootstrapReplicates = memberLenses[0]!.entries[0]!.bootstrap.replicates;

const referenceChartCount = nativeRankingData.corpus.filter(
  (chart) => chart.segment === "reference",
).length;
const currentChartCount = nativeRankingData.corpus.length - referenceChartCount;

const standardLens = memberLenses.find((lens) => lensKey(lens.id) === "one-copy-maximum")!;
const standardBoundaries = nativeMemberTierCalibration.lenses["one-copy-maximum"];

const metrics = [
  {
    symbol: "G",
    name: "General value",
    weight: "55%",
    formula: "G = mean( mᵢ ) over every matched context i",
    detail:
      "The plain average of the card's matched-substitution value. A card that helps a little almost everywhere ranks well here.",
  },
  {
    symbol: "P",
    name: "Synergy ceiling",
    weight: "25%",
    formula: "P = mean of the highest ⌈n/10⌉ values of mᵢ",
    detail:
      "The average of the strongest tenth of contexts, not a single lucky team. This is where cards that need a specific partner earn their place. Each of the three lanes is ranked separately, so they can describe different subsets of contexts.",
  },
  {
    symbol: "B",
    name: "Team breadth",
    weight: "10%",
    formula: "B = share of contexts where u_candidate ≥ 0.95 · max( u_candidate, u_alternatives )",
    detail:
      "How often the card lands within 5% of the strongest option available in that context. Note this metric compares team utilities rather than the marginal above, and the comparison pool includes the card itself, so a card that is the strongest option counts here.",
  },
  {
    symbol: "E",
    name: "Investment efficiency",
    weight: "10%",
    formula: "E = ( G_low + 2 · G_standard + G_max ) ÷ 4",
    detail:
      "The trapezoidal mean of general value across the progression curve, from entry level through the duplicate-enabled ceiling, so cards that arrive useful are separated from cards that need heavy investment. Being a mean across all three progression states, E is identical on all three lenses.",
  },
] as const;

const lanes = [
  {
    id: "lower",
    label: "Lower",
    rule: "Skills overlap completely; only the strongest one counts, and no activation-rate help is assumed.",
    targeting: "Every unresolved skill target resolves to the least favourable recipient.",
  },
  {
    id: "central",
    label: "Central",
    rule: "Skills activate independently and the strongest active one is selected, evaluated as an exact expectation.",
    targeting: "Unresolved targets still resolve to the guaranteed recipient, so central is not the midpoint.",
  },
  {
    id: "upper",
    label: "Upper",
    rule: "Skills never overlap and every activation stacks.",
    targeting: "Every unresolved skill target resolves to the most favourable recipient.",
  },
] as const;

function PipelineDiagram() {
  const stages = [
    { x: 8, label: "Card kit", sub: "parameters, skills" },
    { x: 132, label: "Team utility", sub: "one chart, one context" },
    { x: 256, label: "Matched value", sub: "vs. the cohort" },
    { x: 380, label: "Context average", sub: "per card" },
    { x: 504, label: "G · P · B · E", sub: "four metrics" },
    { x: 628, label: "Index", sub: "100 + 10z" },
    { x: 752, label: "Tier", sub: "gated band" },
  ];
  return (
    <figure className="methodology-figure">
      <svg viewBox="0 0 868 104" role="img" aria-labelledby="pipeline-title">
        <title id="pipeline-title">
          The measurement pipeline, from a single card kit through to a published tier letter
        </title>
        {stages.map((stage, index) => (
          <g key={stage.label}>
            <rect className="mf-node" x={stage.x} y={18} width={108} height={54} rx={8} />
            <text className="mf-node-label" x={stage.x + 54} y={40}>
              {stage.label}
            </text>
            <text className="mf-node-sub" x={stage.x + 54} y={57}>
              {stage.sub}
            </text>
            {index < stages.length - 1 && (
              <path className="mf-arrow" d={`M${stage.x + 108} 45 L${stage.x + 128} 45`} markerEnd="url(#mf-tip)" />
            )}
          </g>
        ))}
        <defs>
          <marker id="mf-tip" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0 0 L7 3.5 L0 7 z" fill="currentColor" />
          </marker>
        </defs>
      </svg>
      <figcaption>
        Each stage is deterministic. Given the same pinned data, the same card produces the same
        letter every time.
      </figcaption>
    </figure>
  );
}

function IndexHistogram() {
  const buckets = new Map<number, number>();
  for (const entry of standardLens.entries) {
    const bucket = Math.floor(entry.index.central / 2) * 2;
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }
  const ordered = [...buckets.entries()].sort((left, right) => left[0] - right[0]);
  const lowest = ordered[0]![0];
  const highest = ordered.at(-1)![0] + 2;
  const tallest = Math.max(...ordered.map(([, count]) => count));
  const span = highest - lowest;
  const toX = (index: number) => ((index - lowest) / span) * 800 + 24;

  const cutoffs = [
    { label: "C", value: standardBoundaries.C },
    { label: "B", value: standardBoundaries.B },
    { label: "A", value: standardBoundaries.A },
    { label: "S", value: standardBoundaries.S },
    { label: "SS", value: standardBoundaries.SS },
  ].filter((cutoff) => cutoff.value >= lowest && cutoff.value <= highest);

  return (
    <figure className="methodology-figure">
      <svg viewBox="0 0 848 208" role="img" aria-labelledby="histogram-title">
        <title id="histogram-title">
          Distribution of the Standard Manual Member index across the roster, with the frozen tier
          cutoffs drawn on top
        </title>
        {ordered.map(([bucket, count]) => {
          const height = (count / tallest) * 118;
          return (
            <rect
              key={bucket}
              className="mf-bar"
              x={toX(bucket)}
              y={150 - height}
              width={Math.max(2, (2 / span) * 800 - 1.5)}
              height={height}
              rx={1.5}
            />
          );
        })}
        <line className="mf-axis" x1={16} y1={150} x2={832} y2={150} />
        {cutoffs.map((cutoff) => (
          <g key={cutoff.label}>
            <line className="mf-cut" x1={toX(cutoff.value)} y1={22} x2={toX(cutoff.value)} y2={150} />
            <text className="mf-cut-label" x={toX(cutoff.value)} y={16}>
              {cutoff.label}
            </text>
            <text className="mf-tick" x={toX(cutoff.value)} y={166}>
              {cutoff.value.toFixed(1)}
            </text>
          </g>
        ))}
        <text className="mf-tick" x={24} y={186}>
          index {lowest.toFixed(0)}
        </text>
        <text className="mf-tick" x={824} y={186} textAnchor="end">
          index {highest.toFixed(0)}
        </text>
      </svg>
      <figcaption>
        Every {publicData.counts.total} Member cards on the Standard Manual lens. The cutoffs were
        frozen from the launch roster, so a new release lands on this axis without shifting any
        existing card&rsquo;s index.
      </figcaption>
    </figure>
  );
}

export default function MethodologyPage() {
  return (
    <div className="database-page methodology-page">
      <header className="database-heading">
        <div className="database-heading-icon">
          <Sigma aria-hidden="true" />
        </div>
        <div>
          <p className="db-eyebrow">Tier list / Methodology</p>
          <h1>Cards are measured inside teams.</h1>
          <p>
            This page is the whole pipeline, with the arithmetic left in. Every tier letter on this
            site is produced by the steps below from pinned card data, a frozen chart benchmark, and
            a fixed set of comparison contexts. Nothing is hand-placed and nothing is voted on.
          </p>
        </div>
        <dl className="database-summary">
          <div>
            <dt>Roster</dt>
            <dd>{publicData.counts.total}</dd>
          </div>
          <div>
            <dt>Charts</dt>
            <dd>{nativeRankingData.corpus.length}</dd>
          </div>
          <div>
            <dt>Lenses</dt>
            <dd>{lensCount}</dd>
          </div>
        </dl>
      </header>

      <PipelineDiagram />

      <section className="record-section">
        <p className="db-eyebrow">Step one</p>
        <h2>What a team is worth on one chart</h2>
        <p>
          Everything starts with a single number for a single legal formation — one Leader Outfit
          and five Member cards from five different talents — playing one Expert chart. That number
          is relative team utility. It is a modelled comparison quantity, not a projected Live
          Score, and the model publishes no absolute-points equation.
        </p>
        <p className="methodology-formula methodology-formula-block">
          U = B + E<sub>param</sub> + (A · B / 1000) + (S · B / 1000)
        </p>
        <ul className="methodology-terms">
          <li>
            <strong>B</strong>
            <span>
              The sum of Performance, Technique and Sense across the five Members, at their
              progression state. These three are the only parameters; attribute and generation are
              skill conditions, not parameters.
            </span>
          </li>
          <li>
            <strong>E<sub>param</sub></strong>
            <span>
              Leader and Passive parameter effects, added together. Effects accumulate additively
              with no cap and no cross-multiplication between categories.
            </span>
          </li>
          <li>
            <strong>A</strong>
            <span>
              The Active-skill rate, in permil, evaluated note by note across the chart against each
              skill&rsquo;s cooldown and duration, then averaged over every note.
            </span>
          </li>
          <li>
            <strong>S</strong>
            <span>
              The Special-skill rate, in permil, derived from how much of the song each Special
              window covers.
            </span>
          </li>
        </ul>
        <p>
          The Active and Special terms are scaled by the unbuffed <strong>B</strong> deliberately.
          The model does not multiply parameter buffs into skill buffs, because the interaction
          between the two is not observable from published data. That is a stated modelling choice,
          and it is the single assumption most likely to matter if it is wrong.
        </p>
      </section>

      <section className="record-section">
        <p className="db-eyebrow">Step two</p>
        <h2>Why every number arrives as a range</h2>
        <p>
          Two things about a formation genuinely cannot be pinned down from published data: how
          often skill activations overlap in a real play, and which member a capped skill picks when
          more than one is eligible. Rather than guess, the evaluator carries three lanes through
          every calculation.
        </p>
        <div className="methodology-lanes">
          {lanes.map((lane) => (
            <article key={lane.id} data-lane={lane.id}>
              <span>{lane.label}</span>
              <p>{lane.rule}</p>
              <small>{lane.targeting}</small>
            </article>
          ))}
        </div>
        <p>
          Read the range as the span between a deliberately pessimistic and a deliberately optimistic
          reading of the same formation. It is <strong>not</strong> a confidence interval, and the
          central value is <strong>not</strong> the midpoint — central shares the lower lane&rsquo;s
          cautious answer to the targeting question and differs from it only on overlap. Candidate
          rules for resolving targets by highest stat, by rarity, by level and by formation order
          were each tested and each contradicted by published behaviour, which is why the ambiguity
          is carried rather than resolved.
        </p>
      </section>

      <section className="record-section">
        <p className="db-eyebrow">Step three</p>
        <h2>What a card&rsquo;s ranking actually compares</h2>
        <p>
          A card is never scored alone. It is dropped into a fixed context — a specific chart, a
          specific Leader, a specific set of four partners and a specific formation slot — and then
          every legal alternative from the frozen comparison cohort of {comparisonCohortSize} cards
          is dropped into that same slot in turn. The card&rsquo;s value in that context is
        </p>
        <p className="methodology-formula methodology-formula-block">
          m<sub>i</sub> = ( u<sub>candidate</sub> − mean(u<sub>alternatives</sub>) ) ÷ max( u<sub>candidate</sub>, u<sub>alternatives</sub> )
        </p>
        <p>
          The numerator is how much the card beats the average stand-in by. The denominator is the
          strongest result anyone achieved in that context, which turns the figure into a share of
          what was achievable there rather than raw utility. Averaging over many contexts is what
          separates a card that is reliably useful from one that happens to suit a single team.
        </p>
        <p>
          On the lower and upper lanes that subtraction is taken <strong>outward</strong> — the
          pessimistic card against the optimistic stand-in, and the optimistic card against the
          pessimistic stand-in. This step is where the ranges widen most: step two supplies the
          endpoints, and this subtraction compounds them.
        </p>
        <p className="methodology-note">
          This is a matched substitution value, not a Shapley value. No coalition game is inferred,
          because the runtime behaviour that would justify one is not observable. Interactions are
          detected by repeating the substitution across balanced partner contexts instead.
        </p>
        <div className="methodology-facts">
          <div>
            <dt>Chart corpus</dt>
            <dd>
              {nativeRankingData.corpus.length} Expert charts — {referenceChartCount} frozen
              reference charts plus the {currentChartCount} newest current charts
            </dd>
          </div>
          <div>
            <dt>Contexts per entity kind</dt>
            <dd>
              {leaderContextCount} scheduled by a cyclic coprime rotation, so partners, Leaders and
              slots are spread evenly rather than sampled at random
            </dd>
          </div>
          <div>
            <dt>Contexts an individual card matches</dt>
            <dd>
              {memberContextRange.min}–{memberContextRange.max} for a Member card, because a context
              is skipped when the card&rsquo;s own talent already appears in it; {leaderContextCount}{" "}
              for a Leader Outfit
            </dd>
          </div>
          <div>
            <dt>Held fixed everywhere</dt>
            <dd>
              Manual play, all-Perfect judgement, full Life, no event bonus, and a declared-neutral
              Board and collection state
            </dd>
          </div>
        </div>
      </section>

      <section className="record-section">
        <p className="db-eyebrow">Step four</p>
        <h2>Four measures, one index</h2>
        <p>
          The per-context values are collapsed into four metrics that answer different questions.
          Each is computed on all three lanes, so each carries its own range.
        </p>
        <div className="methodology-metrics methodology-metrics-wide">
          {metrics.map((metric) => (
            <article key={metric.symbol}>
              <span>{metric.symbol}</span>
              <div>
                <strong>{metric.name}</strong>
                <code>{metric.formula}</code>
                <p>{metric.detail}</p>
              </div>
              <em>{metric.weight}</em>
            </article>
          ))}
        </div>
        <p>
          The four are not comparable as raw numbers, so each is standardised against constants
          frozen from the launch roster before they are combined. The standardisation is robust —
          it uses the median and the median absolute deviation rather than the mean and standard
          deviation, so one extreme release cannot rescale everyone else.
        </p>
        <p className="methodology-formula methodology-formula-block">
          z(x) = ( x − median<sub>frozen</sub> ) ÷ ( 1.4826 · MAD<sub>frozen</sub> )
          <br />
          C = 0.55 · z(G) + 0.25 · z(P) + 0.10 · z(B) + 0.10 · z(E)
          <br />
          index = 100 + 10 · z(C)
        </p>
        <p>
          The 1.4826 is the constant that makes a median absolute deviation a consistent estimator
          of the standard deviation, so z is measured in robust standard deviations rather than in
          raw MADs. The composite is standardised a second time, against its own frozen scale,
          before it becomes an index.
        </p>
        <p>
          So <strong>index 100 is the launch cohort&rsquo;s median card</strong> and{" "}
          <strong>ten index points is one robust standard deviation</strong> of the composite
          distribution — roughly 6.7 index points to one median absolute deviation. Ten points is a
          large step, not a rounding difference.
        </p>
      </section>

      <section className="record-section">
        <p className="db-eyebrow">Step five</p>
        <h2>From index to letter</h2>
        <p>
          Member cutoffs were frozen from the launch index distribution and are never recalibrated,
          which is what allows a new release to be added without moving any existing card&rsquo;s
          index. Leader Outfits use absolute index bands instead — 120, 110, 100, 90 and 80. They
          are standardised against their own frozen launch baseline in exactly the same way, but no
          per-lens tier cutoffs were ever calibrated for them, so their bands are fixed round
          numbers.
        </p>
        <IndexHistogram />
        <div className="methodology-boundaries">
          <table>
            <caption>Frozen Member cutoffs, by progression lens</caption>
            <thead>
              <tr>
                <th scope="col">Lens</th>
                {(["SS", "S", "A", "B", "C"] as const).map((tier) => (
                  <th key={tier} scope="col">
                    {tier}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {memberLenses.map((lens) => {
                const boundaries = nativeMemberTierCalibration.lenses[lensKey(lens.id)];
                return (
                  <tr key={lens.id}>
                    <th scope="row">{lens.label}</th>
                    {(["SS", "S", "A", "B", "C"] as const).map((tier) => (
                      <td key={tier}>{boundaries[tier].toFixed(2)}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="record-section methodology-gate">
        <p className="db-eyebrow">Step six — the part people ask about</p>
        <h2>Why nothing on this site is rated SS or D</h2>
        <p>
          Landing above a cutoff is not enough to be published there. The two extreme letters carry
          an evidence gate on top of the boundary, and the gate can only ever demote:
        </p>
        <ul className="methodology-gate-rules">
          <li>
            <strong>SS becomes S</strong> unless at least 90% of {bootstrapReplicates} resampling
            replicates put the card&rsquo;s whole index range above 120,{" "}
            <em>and</em> at least 80% put it in the top tenth of the roster.
          </li>
          <li>
            <strong>D becomes C</strong> unless at least 80% of replicates put the card&rsquo;s
            whole index range below 80, <em>and</em> at least 80% of its measured contexts show a
            definitely negative contribution.
          </li>
        </ul>
        <p>
          On the current data those thresholds are never met, and the effect is large enough that
          hiding it would be dishonest:
        </p>
        <div className="methodology-gate-figures">
          <div>
            <b>{gateEffect.rawSS}</b>
            <span>
              of the {allRows.length} published rows ({publicData.counts.total} cards × {lensCount}{" "}
              lenses) sit above the SS cutoff on their index
            </span>
            <i>{gateEffect.publishedSS} are published as SS</i>
          </div>
          <div>
            <b>{gateEffect.rawD}</b>
            <span>of the same {allRows.length} rows sit below the C cutoff on their index</span>
            <i>{gateEffect.publishedD} are published as D</i>
          </div>
        </div>
        <p>
          Two separate things stop them, and neither is simply a lack of precision.
        </p>
        <p>
          <strong>For SS, the two rules are measured on different scales.</strong> The frozen Member
          cutoff for SS sits near {standardBoundaries.SS.toFixed(1)}, while the gate asks for the
          index range to clear an absolute 120. The highest central index anywhere on the site is{" "}
          {highestCentralIndex.toFixed(1)}. Nothing on the roster reaches 120 even at its most
          optimistic reading, so no Member card can pass that test however precisely it is measured.
          The gate&rsquo;s other requirement — being in the top tenth of the roster — is met
          comfortably by every one of those {gateEffect.rawSS} rows.
        </p>
        <p>
          <strong>For D, one requirement is unmet everywhere.</strong> A card is only published D if
          most of its measured contexts show a definitely negative contribution, and no context
          anywhere in the data currently does. Range width matters here too — the typical published
          index range is about {Math.round(medianIntervalWidth)} points wide — but the negative
          contribution requirement alone blocks D across the entire roster.
        </p>
        <p>
          The honest consequence is that <strong>C currently means two different things</strong> —
          &ldquo;genuinely a C&rdquo; and &ldquo;possibly a D, but the evidence does not support
          saying so&rdquo; — and <strong>S is the effective top of the ladder</strong>.
        </p>
        <p>
          Every row on the site is also marked provisional internally. A rating is treated as
          settled only when its index range is ten points or narrower, its resampling error is at
          most half a point, and its source coverage is complete. Range width is the binding
          constraint: the narrowest range on the site is still about{" "}
          {Math.round(intervalWidths[0] ?? 0)} points, so no row qualifies, even though most rows
          already meet the resampling-error condition. The tier list is published as theorycraft,
          and the absolute-points model is deliberately marked unavailable.
        </p>
      </section>

      <section className="record-section">
        <p className="db-eyebrow">Reading the results honestly</p>
        <h2>What this measurement does not tell you</h2>
        <ul className="methodology-caveats">
          <li>
            <strong>It is not a Live Score forecast.</strong> No absolute scoring equation is
            published, and none is fitted. Two cards one index point apart are not distinguishable.
          </li>
          <li>
            <strong>It does not model play skill, or anything but a clean run.</strong> Every
            evaluation assumes manual play at all-Perfect judgement with full Life.
          </li>
          <li>
            <strong>It does not model note timing individually.</strong> Notes are placed on a
            uniform grid from the chart&rsquo;s note count and duration, and Special windows are
            treated as duration coverage rather than as marked moments.
          </li>
          <li>
            <strong>It does not model your account.</strong> Board, collection bonus and Connect
            effects are held neutral so that cards are compared, not collections.
          </li>
          <li>
            <strong>It does not price availability.</strong> Banner history, rate-ups and how hard a
            card is to obtain are outside the model entirely.
          </li>
          <li>
            <strong>The three progression lenses mostly agree, but not entirely.</strong>{" "}
            {memberLensDisagreements} of the {publicData.counts.total} Member cards and{" "}
            {leaderLensDisagreements} Leader Outfits are placed in different tiers by different
            lenses — Low Investment and Standard Manual are near-identical, and Max Ceiling is the
            one that moves cards. The letters coincide as often as they do because the cutoffs are
            frozen <em>per lens</em>, so most of the index lift a lens gives a card is absorbed by
            the higher cutoff it is then measured against. The three lenses also produce identical
            tier <em>counts</em>, which makes them look more interchangeable than they are.
          </li>
        </ul>
      </section>

      <section className="record-section">
        <p className="db-eyebrow">Provenance</p>
        <h2>What this run was pinned to</h2>
        <div className="methodology-facts">
          <div>
            <dt>Ranking snapshot</dt>
            <dd>{nativeRankingData.snapshotId}</dd>
          </div>
          <div>
            <dt>Chart benchmark</dt>
            <dd>{nativeRankingData.benchmarkId}</dd>
          </div>
          <div>
            <dt>Tier calibration</dt>
            <dd>{nativeRankingData.tierCalibrationId}</dd>
          </div>
          <div>
            <dt>Evaluator</dt>
            <dd>{nativeRankingData.evaluatorVersion}</dd>
          </div>
          <div>
            <dt>Card data commit</dt>
            <dd>{nativeRankingData.rosterCommit.slice(0, 12)}</dd>
          </div>
          <div>
            <dt>Roster</dt>
            <dd>
              {publicData.counts.total} Outfits across {publicData.counts.talents} talents
            </dd>
          </div>
        </div>
      </section>

      <div className="guide-next-actions">
        <Link className="button-primary" href="/tier-list">
          Open tier list <ArrowRight aria-hidden="true" />
        </Link>
        <Link className="button-secondary" href="/cards">
          Browse cards and Outfits
        </Link>
      </div>
    </div>
  );
}
