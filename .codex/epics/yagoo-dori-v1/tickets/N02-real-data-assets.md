---
id: N02
title: Pinned real dataset and public artwork intake
status: done
depends_on: [N01]
parallelizable: true
parent_epic: yagoo-dori-v1
---

# N02: Pinned real dataset and public artwork intake

## Acceptance criteria

- [x] HolodoriDB English and Japanese inputs are pinned by exact commit.
- [x] Every real 4★ and 5★ card is normalized with talent, title, rarity, attribute, generation, and source metadata.
- [x] Active, Passive, Special, and Leader/Outfit source records are joined without invented field meanings.
- [x] Public card art is stored locally and mapped to the correct card.
- [x] Asset provenance is validated backstage and no public rights placeholder remains.
- [x] Counts and representative records are corroborated against AppMedia or Game8.

## Verification evidence

- `pnpm assets:check`: 226 local game images with manifest hashes.
- `pnpm data:validate`: 54 talents, 59 five-stars, 54 four-stars, 113 mapped records.
- `pnpm test`: pinned commits, tier split, multi-group membership, and AZKi joined-data regression pass.
