# Implementation Plan: Static Diagram → Configurable Dashboard

## Overview

Four files change. Three are structural (HTML, CSS, JS). The SVG animation engine, energy unit shape, gradient definitions, and glow keyframes are untouched.

| File | Type of change |
|---|---|
| `index.html` | Wrap existing elements in named `<g>` groups — no geometry changes |
| `src/input.css` | Add one utility class |
| `src/scripts/animations.js` | Add `DiagramController`, refactor `updateEnergyFlow`, remove the hardcoded MutationObserver bridge |
| `assets/css/output.min.css` | Rebuild from CSS after the Tailwind change |

---

## Phase 1 — HTML: Add wrapper groups

**Goal:** Give JS a single element to target per node and per track, without touching any path geometry.

There are **5 wraps** to add total.

---

### 1a. Horizontal track wrapper

Wrap the two rail paths and the mover `<g>` in a single `<g id="track-solar-grid">`.

**Before:**
```html
<!-- === Horizontal track: solar → grid === -->
<path id="flow-track-line" d="M594 110.5H111.5" .../>
<path d="M594 110.5H111.5" stroke="#ccd8d5" stroke-width="5" fill="none"/>
<g id="main-flow-line" class="energy-unit-mover">
    ...
</g>
```

**After:**
```html
<!-- === Horizontal track: solar → grid === -->
<g id="track-solar-grid">
    <path id="flow-track-line" d="M594 110.5H111.5" .../>
    <path d="M594 110.5H111.5" stroke="#ccd8d5" stroke-width="5" fill="none"/>
    <g id="main-flow-line" class="energy-unit-mover">
        ...
    </g>
</g>
```

---

### 1b. Vertical track wrapper

**Before:**
```html
<!-- === Vertical track: grid → battery === -->
<path id="flow-track-line-vertical" d="M586 110L586 518" .../>
<path d="M586 110L586 518" stroke="#ccd8d5" stroke-width="5" fill="none"/>
<g id="vertical-flow-line" class="energy-unit-mover">
    ...
</g>
```

**After:**
```html
<!-- === Vertical track: grid → battery === -->
<g id="track-grid-battery">
    <path id="flow-track-line-vertical" d="M586 110L586 518" .../>
    <path d="M586 110L586 518" stroke="#ccd8d5" stroke-width="5" fill="none"/>
    <g id="vertical-flow-line" class="energy-unit-mover">
        ...
    </g>
</g>
```

---

### 1c. Solar node wrapper

Currently the node background `<g>` and the icon clip-path `<g>` are separate siblings. Both need to be enclosed.

**Before:**
```html
<!-- Left: Solar panels -->
<g class="node-background">
    <rect width="220" height="220" rx="110" fill="url(#base-dark)"/>
    <rect class="glow-target" width="220" height="220" rx="110" fill="url(#glow-solar)"/>
</g>
<g clip-path="url(#clip0_1002_363)">
    ... icon paths ...
</g>
```

**After:**
```html
<!-- Left: Solar panels -->
<g id="node-solar">
    <g class="node-background">
        <rect width="220" height="220" rx="110" fill="url(#base-dark)"/>
        <rect class="glow-target" width="220" height="220" rx="110" fill="url(#glow-solar)"/>
    </g>
    <g clip-path="url(#clip0_1002_363)">
        ... icon paths ...
    </g>
</g>
```

---

### 1d. Grid node wrapper

**Before:**
```html
<!-- Top-right: Grid / meter -->
<g class="node-background">
    <rect x="476" width="220" height="220" rx="110" fill="url(#base-dark)"/>
    <rect class="glow-source" x="476" width="220" height="220" rx="110" fill="url(#glow-grid)"/>
</g>
<g clip-path="url(#clip1_1002_363)">
    ... icon paths ...
</g>
```

**After:**
```html
<!-- Top-right: Grid / meter -->
<g id="node-grid">
    <g class="node-background">
        <rect x="476" width="220" height="220" rx="110" fill="url(#base-dark)"/>
        <rect class="glow-source" x="476" width="220" height="220" rx="110" fill="url(#glow-grid)"/>
    </g>
    <g clip-path="url(#clip1_1002_363)">
        ... icon paths ...
    </g>
</g>
```

---

### 1e. Battery node wrapper

**Before:**
```html
<!-- Bottom-right: Battery -->
<g class="node-background">
    <rect x="476" y="408" width="220" height="220" rx="110" fill="url(#base-dark)"/>
    <rect class="glow-target" x="476" y="408" width="220" height="220" rx="110" fill="url(#glow-battery)"/>
</g>
<g clip-path="url(#clip2_1002_363)">
    ... icon paths ...
</g>
```

**After:**
```html
<!-- Bottom-right: Battery -->
<g id="node-battery">
    <g class="node-background">
        <rect x="476" y="408" width="220" height="220" rx="110" fill="url(#base-dark)"/>
        <rect class="glow-target" x="476" y="408" width="220" height="220" rx="110" fill="url(#glow-battery)"/>
    </g>
    <g clip-path="url(#clip2_1002_363)">
        ... icon paths ...
    </g>
</g>
```

---

## Phase 2 — CSS: Add `.diagram-hidden`

Append to the Energy Flow Animation section in `src/input.css`:

```css
.diagram-hidden {
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.5s ease;
}
```

Using `opacity` instead of `display: none` preserves layout space (nodes don't reflow when hidden) and allows CSS transitions. `pointer-events: none` prevents hidden elements from intercepting mouse events.

Then rebuild:
```bash
npx tailwindcss -i src/input.css -o assets/css/output.min.css --minify
```

---

## Phase 3 — JS: Refactor `animations.js`

Three things change inside this file:

1. **Remove** the hardcoded MutationObserver bridge — it was only needed because `updateEnergyFlow` wrote CSS variables that SMIL couldn't read. `DiagramController` writes directly to SMIL attributes, making the bridge obsolete.
2. **Replace** `updateEnergyFlow` with a thin wrapper that delegates to `DiagramController` for backward compatibility on the static site.
3. **Add** `DiagramController`.

---

### 3a. Remove the MutationObserver bridge

Delete this entire block from inside `DOMContentLoaded`:

```js
// DELETE THIS BLOCK
const mover      = document.getElementById('main-flow-line');
const motionAnim = document.getElementById('energy-motion-anim');

if (mover && motionAnim) {
    new MutationObserver(() => {
        const s     = mover.style;
        const speed = s.getPropertyValue('--flow-speed').trim();
        const dir   = s.getPropertyValue('--flow-direction').trim();

        if (speed) motionAnim.setAttribute('dur', speed);
        if (dir)   motionAnim.setAttribute('keyPoints', dir === 'reverse' ? '1;0' : '0;1');

        const svg = mover.ownerSVGElement;
        if (!svg) return;
        if (s.animationPlayState === 'paused') {
            svg.pauseAnimations();
        } else {
            svg.unpauseAnimations();
        }
    }).observe(mover, { attributes: true, attributeFilter: ['style'] });
}
```

---

### 3b. Replace `updateEnergyFlow`

The static homepage still calls `updateEnergyFlow(watts)`. Keep the function signature but delegate to `DiagramController`:

```js
function updateEnergyFlow(powerInWatts) {
    DiagramController.updateFlow('solar-grid', powerInWatts);
}
```

Also remove the old `document.documentElement.style.setProperty('--flow-speed', ...)` line that was inside the original implementation — `DiagramController.updateFlow` handles per-node variable writes instead.

---

### 3c. Add `DiagramController`

Add this object above the `DOMContentLoaded` listener:

```js
const DiagramController = {

    NODES: {
        solar:   'node-solar',
        grid:    'node-grid',
        battery: 'node-battery',
    },

    TRACKS: {
        'solar-grid': {
            wrapper: 'track-solar-grid',
            mover:   'main-flow-line',
            anim:    'energy-motion-anim',
            source:  'node-grid',    // unit departs from grid (path starts at x=594)
            target:  'node-solar',   // unit arrives at solar (path ends at x=111)
        },
        'grid-battery': {
            wrapper: 'track-grid-battery',
            mover:   'vertical-flow-line',
            anim:    'energy-motion-anim-vertical',
            source:  'node-grid',
            target:  'node-battery',
        },
    },

    apply(config) {
        for (const [name, options] of Object.entries(config.nodes ?? {})) {
            this.setNodeVisible(name, options.visible);
        }
        for (const [trackId, options] of Object.entries(config.flows ?? {})) {
            if (options.watts == null) {
                this.setTrackVisible(trackId, false);
            } else {
                this.setTrackVisible(trackId, true);
                this.updateFlow(trackId, options.watts);
            }
        }
    },

    setNodeVisible(name, visible) {
        const el = document.getElementById(this.NODES[name]);
        if (!el) return;
        el.classList.toggle('diagram-hidden', !visible);
    },

    setTrackVisible(trackId, visible) {
        const ids = this.TRACKS[trackId];
        const el  = document.getElementById(ids?.wrapper);
        if (!el) return;
        el.classList.toggle('diagram-hidden', !visible);
    },

    updateFlow(trackId, watts) {
        const ids   = this.TRACKS[trackId];
        const mover = document.getElementById(ids?.mover);
        const anim  = document.getElementById(ids?.anim);
        if (!mover || !anim) return;

        if (watts === 0) {
            mover.style.opacity = '0.2';
            mover.ownerSVGElement?.pauseAnimations();
            return;
        }

        mover.style.opacity = '1';
        mover.ownerSVGElement?.unpauseAnimations();

        const speed = Math.max(0.3, Math.min(5000 / Math.abs(watts), 6));
        anim.setAttribute('dur', `${speed}s`);
        anim.setAttribute('keyPoints', watts < 0 ? '1;0' : '0;1');

        // Set --flow-speed on each connected node directly, not on :root
        const speedVal = `${speed}s`;
        document.getElementById(ids.source)?.style.setProperty('--flow-speed', speedVal);
        document.getElementById(ids.target)?.style.setProperty('--flow-speed', speedVal);
    },
};
```

---

## Phase 4 — Remove the `:root` variable write

In the original `updateEnergyFlow`, this line must be deleted:

```js
// DELETE — replaced by per-node writes inside DiagramController.updateFlow
document.documentElement.style.setProperty('--flow-speed', `${speed}s`);
```

The glow CSS animations use `var(--flow-speed, 2s)`. Each node element now carries its own value set by `DiagramController.updateFlow`, which CSS variable inheritance resolves correctly. The `2s` fallback applies to any node that has not yet received a value (e.g. Battery before a flow is configured).

---

## Phase 5 — Verification checklist

After all changes, confirm each of these works in the browser:

- [ ] Static site loads — Solar and Grid visible, both tracks running at default speed
- [ ] `updateEnergyFlow(3200)` — horizontal unit speeds up; Grid glow-source fires, Solar glow-target fires
- [ ] `updateEnergyFlow(-800)` — horizontal unit reverses direction
- [ ] `updateEnergyFlow(0)` — horizontal unit dims and pauses
- [ ] `DiagramController.setNodeVisible('battery', false)` — Battery fades out smoothly
- [ ] `DiagramController.setNodeVisible('battery', true)` — Battery fades back in
- [ ] `DiagramController.setTrackVisible('grid-battery', false)` — vertical track fades out
- [ ] `DiagramController.apply({ nodes: { battery: { visible: false } }, flows: { 'solar-grid': { watts: 1500 }, 'grid-battery': { watts: null } } })` — full config applied in one call
- [ ] Both flows at different wattages simultaneously — glow animations on each node run at their own correct speed independently
- [ ] Grid node glow responds to whichever flow last updated it (expected, as it participates in both tracks)

---

## What is not touched

- SVG path geometry (`d="..."` attributes)
- Energy unit shape paths and VFX filters
- Gradient definitions in `<defs>`
- `@keyframes glow-pulse-out` / `glow-pulse-in`
- `.glow-source` / `.glow-target` / `.energy-unit-mover` CSS classes
- The `IntersectionObserver` scroll animation (unrelated, stays as-is)
