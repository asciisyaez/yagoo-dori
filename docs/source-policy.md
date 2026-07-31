# Source and evidence policy

Yagoo-dori is a noncommercial research project. “Publicly visible” does not mean “free to redistribute.” Facts, data files, prose, and images each require an explicit basis for use.

## Hierarchy

1. Official hololive Dreams, QualiArts, COVER, and in-scope publisher material.
2. Structured community data with a license that permits the intended reuse.
3. Independently corroborated public guides, used as secondary evidence and attributed.

HolodoriDB English and Japanese diff repositories may reveal that something changed. They are not vendored, mirrored, or treated as reusable databases while no reuse license is declared. A change signal must be independently verified in a permitted durable source before publication.

## Collection boundaries

Allowed collection is limited to durable public pages and exports whose access and reuse terms permit it. Contributors must not:

- bypass bot or scrape protection;
- extract or decrypt a game client;
- intercept private APIs;
- automate an installed game or account;
- copy clean artwork merely because it can be downloaded;
- silently resolve conflicting numerical claims.

## Record contract

Every normalized record carries:

- stable local ID and localization-ready display fields;
- source IDs and direct URLs in the source ledger;
- retrieval date and upstream version/commit when one exists;
- game patch and methodology version where relevant;
- verification state (`verified`, `corroborated`, `research-only`, or `disputed`);
- confidence from 0 to 1;
- an illustrative flag for fixture-only values.

`verified` means supported by an allowed primary source. `corroborated` means multiple allowed secondary sources agree. `research-only` is useful for pipeline testing but cannot ship as a factual claim. `disputed` enters review and cannot be ranked.

## Conflict review

Numerical disagreements are added to `data/review-queue.json` with both claims, source IDs, and an open resolution. Reviewers may resolve only by recording a stronger permitted source and a rationale. Code never chooses the larger, newer, or more popular claim automatically.

## Editorial comparisons

Third-party tier lists and sentiment may appear in a separately labeled comparison note with attribution. They never feed team utility, card contribution metrics, confidence, or tier placement.

## Artwork

Every visual file under `apps/web/public` must have an `approved` entry in `data/assets.json`, including provenance and reuse basis. `conditional` and `blocked` assets may be retained in research notes but never copied into the production bundle. The build runs `pnpm rights:check`.

Preferred sources are a publisher media kit or explicit written permission. A fallback may use a gameplay screenshot only when its captor grants reuse and the page adds substantive analysis consistent with applicable noncommercial guidelines. Until then, cards use the original `Art pending rights` component and link to an official source where available.

## Publication gates

The public release remains blocked until:

1. the 4-star/5-star dataset is complete and verified;
2. all artwork is approved or replaced with the rights-safe treatment;
3. ranking validation and confidence rules pass, or every affected view retains Theorycraft Beta;
4. source, rights, content, browser, and rollback checks pass;
5. the user approves staging and production changes.

