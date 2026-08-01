---
id: N03A
title: Evidence-linked mechanics catalog and schemas
status: done
depends_on: [N02]
parallelizable: true
parent_epic: yagoo-dori-v1
---

# N03A: Evidence-linked mechanics catalog and schemas

## Acceptance criteria

- [x] Every current Active, Passive, Special, Leader, Connect, Board, trigger, target, cap, and progression variant is mapped or explicitly unresolved.
- [x] Performance, Technique, Sense, attributes, generations, levels, rarities, and investment states are represented with source-linked semantics.
- [x] Source disagreements and unknown runtime behavior remain explicit rather than silently merged.
- [x] Schemas reject an unmapped or unresolved effect used by a scored card.
- [x] Golden fixtures cover AZKi, Suisei, Haato, Aki, Iroha, Okayu, Sora, and a seasonal Outfit/card family.
- [x] Tests prove enumerated-effect coverage, compilation coverage, and evidence-ledger integrity before any native score is allowed.
