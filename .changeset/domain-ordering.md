---
"@morpha/domain": minor
---

Add the fractional-index ordering utility (Ordering-Strategy.md):
`generateKeyBetween`, `generateNKeysBetween`, `compareOrderKeys`,
`compareOrdered` and the `Ordered` shape. Collision-avoidance jitter is drawn
from the injected `Rng` (ADR-0005 §3), so key generation is replayable under a
seeded source, and `compareOrdered` applies the required `id` tie-break.

The base-62 algorithm is vendored with attribution rather than taken as a
dependency, because this package carries no runtime dependencies.
