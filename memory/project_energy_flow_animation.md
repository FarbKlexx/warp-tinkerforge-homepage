---
name: Energy flow animation architecture
description: How the SVG energy flow animation system is built and why — important for adding new flow paths
type: project
---

The energy flow animation uses SVG `<animateMotion>` (SMIL) + a JS bridge, not CSS Motion Path.

**Why:** CSS `offset-path: path()` on SVG `<g>` elements uses CSS pixel coordinates, not SVG user units. When the SVG scales with its flex container, the path resolves to the wrong position. SMIL `<animateMotion>` operates natively in SVG coordinate space and is immune to this scaling issue.

**Pattern for each animated path:**
1. A static `<path id="some-track-id" ...>` as the reference track (referenced by `<mpath>`).
2. A `<g id="some-mover-id" class="energy-unit-mover">` containing:
   - `<animateMotion id="some-anim-id" rotate="auto-reverse" keyPoints="0;1" keyTimes="0;1" calcMode="linear"><mpath href="#some-track-id"/></animateMotion>`
   - `<g transform="scale(0.65)" style="filter: blur(1.5px) drop-shadow(0 0 8px rgba(5,180,255,0.9));">` wrapping the energy-unit SVG shape
3. Speed and direction are controlled via a MutationObserver bridge in `animations.js` that reads `--flow-speed` and `--flow-direction` CSS variables set on the mover `<g>` and translates them to `dur` and `keyPoints` attributes on `<animateMotion>`.
4. Pause/resume uses `ownerSVGElement.pauseAnimations()` / `unpauseAnimations()`.

**To add a new flow path:** duplicate the track + mover pair, give them new IDs, point `<mpath href>` at the new track ID, and call `updateEnergyFlow`-style logic targeting the new mover ID.

**Why:** Scalability was an explicit design goal — multiple independent paths, each with its own speed and direction, with no changes needed to the core `updateEnergyFlow` function.
