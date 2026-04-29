# SVG Energy Flow Diagram — Technical Documentation

> Designed and developed by coupling media GmbH on behalf of Tinkerforge GmbH.

---

## 1. Architektur-Überblick (High-Level Concept)

The diagram is built around a strict three-layer separation of concerns. Each layer has exactly one responsibility and no layer bleeds into another.

| Layer | Responsibility |
|---|---|
| **HTML / SVG** | Static geometry: track paths, node circles, icon artwork, gradient definitions |
| **CSS** | 100% of visual animation: keyframe timing, glow opacity, filter effects |
| **JavaScript** | Live data bridge only: translates watt values into CSS custom properties |

JavaScript never touches the DOM to move elements or change colors directly. It writes a single number — the power in watts — and the CSS + SVG engine takes care of everything else. This means animations always run on the compositor thread at 60 fps, independent of JavaScript execution cost.

```
Sensor / Backend
      │
      ▼
updateEnergyFlow(watts)        ← only entry point
      │
      ▼  writes CSS variables + inline style
#main-flow-line (SVG <g>)
      │
      ▼  MutationObserver bridge
<animateMotion> SMIL attributes   ←  moves the energy unit along the path
document.documentElement          ←  --flow-speed inherited by node glow CSS animations
```

---

## 2. Die Animations-Engine (SVG SMIL animateMotion)

### Why not CSS Motion Path (`offset-path`)?

CSS `offset-path: path(...)` was the first approach attempted. It was abandoned because `path()` coordinates on an SVG `<g>` element are interpreted in CSS pixel space, not in the SVG's own user-unit coordinate system. When the SVG scales with its flex container (as it does here via Tailwind), the element tracks the wrong position — it drifts to wherever those pixel coordinates happen to fall on screen.

### The chosen approach: SVG SMIL `<animateMotion>`

SMIL's `<animateMotion>` resolves its path natively in SVG user-unit space and is completely immune to CSS scaling. The track geometry defined in SVG coordinates is used directly, at any container size.

Each animated track requires exactly two elements:

**1. A reference track path** — a regular `<path>` with a unique `id`, drawn invisibly or as the visual rail:

```html
<path
  id="flow-track-line"
  d="M594 110.5H111.5"
  stroke="#ccd8d5"
  stroke-width="5"
/>
```

**2. A mover group** — a `<g>` that contains the `<animateMotion>` element and the energy unit shape. The `<mpath>` child points at the reference track by ID:

```html
<g id="main-flow-line" class="energy-unit-mover">
  <animateMotion
    id="energy-motion-anim"
    dur="2s"
    repeatCount="indefinite"
    rotate="auto-reverse"
    keyPoints="0;1"
    keyTimes="0;1"
    calcMode="spline"
    keySplines="0.42 0 0.58 1"
  >
    <mpath href="#flow-track-line"/>
  </animateMotion>

  <!-- energy unit shape goes here -->
</g>
```

### Key attributes explained

| Attribute | Value | Effect |
|---|---|---|
| `rotate="auto-reverse"` | fixed | Auto-steers the shape tangent to the path, then adds 180° so the round head leads |
| `keyPoints="0;1"` | dynamic | Forward traversal; `"1;0"` reverses direction without redefining the path |
| `keyTimes="0;1"` | fixed | Must always have the same number of values as `keyPoints` |
| `calcMode="spline"` + `keySplines` | fixed | Applies a cubic bezier ease-in-out so the unit accelerates away from nodes and decelerates on approach |
| `dur` | set by JS bridge | Controls travel speed; written by the MutationObserver bridge |

### The CSS variable → SMIL bridge

SMIL attributes cannot read CSS custom properties. The bridge (`animations.js`) watches the inline `style` attribute of `#main-flow-line` via a `MutationObserver` and translates changes into SMIL attributes in real time:

```js
new MutationObserver(() => {
    const speed = mover.style.getPropertyValue('--flow-speed').trim();
    const dir   = mover.style.getPropertyValue('--flow-direction').trim();

    if (speed) motionAnim.setAttribute('dur', speed);
    if (dir)   motionAnim.setAttribute('keyPoints', dir === 'reverse' ? '1;0' : '0;1');

    if (mover.style.animationPlayState === 'paused') {
        mover.ownerSVGElement.pauseAnimations();
    } else {
        mover.ownerSVGElement.unpauseAnimations();
    }
}).observe(mover, { attributes: true, attributeFilter: ['style'] });
```

Pause/resume uses `ownerSVGElement.pauseAnimations()` / `unpauseAnimations()` to halt the entire SVG SMIL timeline, which is the only reliable way to pause SMIL animations.

---

## 3. Die Energie-Einheit (Composite Shape & VFX)

The energy unit is a comet/teardrop shape — a wide, glowing round head that tapers to a sharp point in the direction of travel.

### Shape geometry

The shape is a custom SVG path (295 × 13 px, designed in Figma) inlined directly into the mover group. It consists of two stacked paths:

- **Cyan body** (`#05B4FF`): the main teardrop silhouette, wide at the right (x=295), tapering to a point at the left (x=0)
- **White inner highlight**: a smaller, offset teardrop inside the cyan body, creating a specular glint

```html
<svg x="-147.5" y="-6.5" width="295" height="13" viewBox="0 0 295 13">
  <!-- Cyan body -->
  <path d="M295 7.29L63.85 13 ... 0L295 7.29Z" fill="#05B4FF"/>
  <!-- White specular highlight -->
  <path d="M209 7.05L51.5 11 ... 2L209 7.05Z" fill="white"/>
</svg>
```

### Centering on the path point

The `<animateMotion>` element places the group's `(0, 0)` origin on the path. To center the shape on that point, the inner `<svg>` is offset by exactly half its own dimensions:

```
x = -(width / 2)  = -(295 / 2) = -147.5
y = -(height / 2) = -(13  / 2) = -6.5
```

If the shape is replaced with a new one from Figma, update both offset values accordingly.

### Scale and VFX filters

The shape group is wrapped in a `<g>` that applies two effects simultaneously:

```html
<g transform="scale(0.65)"
   style="filter: blur(1.5px)
                  drop-shadow(0 0 8px rgba(5, 180, 255, 0.9))
                  drop-shadow(0 0 8px #5384FF);">
```

| Effect | Purpose |
|---|---|
| `scale(0.65)` | Reduces the shape to 65% while keeping it centered at (0,0) |
| `blur(1.5px)` | Softens the edges to simulate motion blur |
| `drop-shadow(0 0 8px rgba(5,180,255,0.9))` | Cyan outer glow — simulates light emission |
| `drop-shadow(0 0 8px #5384FF)` | Blue secondary glow — adds depth to the halo |

`drop-shadow` (unlike `box-shadow`) respects the shape's alpha channel, so the glow wraps the comet silhouette exactly.

---

## 4. Interaktives Node-Glow (Opacity Crossfade)

When the energy unit departs from or arrives at a node, the node briefly illuminates — simulating light reflecting off the arriving energy.

### Layered SVG background

Each node background is built from two stacked `<rect>` elements inside a `<g class="node-background">`:

```html
<g class="node-background">
  <!-- Layer 1: solid dark base, always visible -->
  <rect width="220" height="220" rx="110" fill="url(#base-dark)"/>

  <!-- Layer 2: directional glow overlay, opacity animated by CSS -->
  <rect class="glow-source" width="220" height="220" rx="110" fill="url(#glow-grid)"/>
</g>
```

Animating `opacity` on the overlay rect is chosen deliberately over animating gradient colors or `fill` values — opacity is composited on the GPU and guaranteed to be smooth even on low-end hardware.

### Directional linear gradients

Each node uses a unique linear gradient oriented toward its connection side, so the glow appears to emanate from exactly the right edge:

| Node | Class | Gradient direction | Reasoning |
|---|---|---|---|
| Solar | `glow-target` | Left → Right (`x1=0 → x2=1`) | Energy unit arrives from the right |
| Grid | `glow-source` | Right → Left, Top → Bottom diagonal (225°) | Departs left (to Solar) and down (to Battery); gradient bisects both exits |
| Battery | `glow-target` | Bottom → Top (`y1=1 → y2=0`) | Energy unit arrives from above |

```html
<!-- In SVG <defs> -->
<linearGradient id="glow-solar" x1="0" y1="0.5" x2="1" y2="0.5">...</linearGradient>
<linearGradient id="glow-grid"  x1="1" y1="0"   x2="0" y2="1"  >...</linearGradient>
<linearGradient id="glow-battery" x1="0" y1="1" x2="0" y2="0"  >...</linearGradient>
```

### Keyframe animations

The glow animations use `ease-in-out` for smooth fade transitions, and both start and end at `opacity: 0` so the loop boundary is seamless (no hard cut):

```css
/* Source node: bright flash at departure (peaks at 20%), fades out by 50% */
@keyframes glow-pulse-out {
    0%   { opacity: 0; }
    20%  { opacity: 1; }
    50%  { opacity: 0; }
    100% { opacity: 0; }
}

/* Target node: builds up from 50%, peaks at 70%, fades out by 100% */
@keyframes glow-pulse-in {
    0%   { opacity: 0; }
    50%  { opacity: 0; }
    70%  { opacity: 1; }
    100% { opacity: 0; }
}

.glow-source {
    animation: glow-pulse-out var(--flow-speed, 2s) ease-in-out infinite;
}

.glow-target {
    animation: glow-pulse-in var(--flow-speed, 2s) ease-in-out infinite;
}
```

### Synchronization mechanism

Both `.glow-source` and `.glow-target` consume the same `--flow-speed` CSS custom property as the `<animateMotion>` duration. When `updateEnergyFlow` is called with new wattage data, it writes `--flow-speed` to **two locations**:

1. `#main-flow-line` inline style — picked up by the MutationObserver SMIL bridge
2. `document.documentElement` style — inherited by all CSS animations on the page, including the node glows

This single write keeps the energy unit travel time and the node glow cycle time permanently in sync without any additional coordination logic.

---

## 5. JavaScript API & Steuerung (Integration Guide)

The entire diagram is controlled through one function:

```js
updateEnergyFlow(powerInWatts);
```

### Parameters

| Value | Behavior |
|---|---|
| `0` | Pauses all animation; dims energy unit to 20% opacity |
| Positive (e.g. `1500`) | Runs forward (solar → grid direction); speed scales with magnitude |
| Negative (e.g. `-800`) | Runs in reverse (grid → solar direction); speed scales with magnitude |

### Speed mapping

Speed is calculated as `5000 / Math.abs(watts)` and clamped to the range `[0.3s, 6s]`:

| Wattage | Animation duration |
|---|---|
| 500 W or less | 6s (slowest) |
| 1 000 W | 5s |
| 2 500 W | 2s |
| 5 000 W | 1s |
| 20 000 W or more | 0.3s (fastest) |

### Usage examples

```js
// Morning: solar producing 3.2 kW, flowing to grid
updateEnergyFlow(3200);

// Evening: drawing 1.1 kW from grid
updateEnergyFlow(-1100);

// Midnight: no active flow
updateEnergyFlow(0);
```

### What the function writes internally

```js
// On the mover element (read by the SMIL bridge)
flowLine.style.setProperty('--flow-speed', `${speed}s`);
flowLine.style.setProperty('--flow-direction', watts < 0 ? 'reverse' : 'normal');
flowLine.style.animationPlayState = 'running' | 'paused';
flowLine.style.opacity = '1' | '0.2';

// On :root (inherited by node glow CSS animations)
document.documentElement.style.setProperty('--flow-speed', `${speed}s`);
```

### Adding control for the vertical track

Currently `updateEnergyFlow` controls only the horizontal track (`#main-flow-line`). To wire up the vertical track (`#vertical-flow-line`), duplicate the function targeting `vertical-flow-line` and `energy-motion-anim-vertical`.

---

## 6. Wartung & Design-Anpassungen (Designer's Guide)

### Updating a track path

Each track is defined by a `d="..."` attribute on a `<path>` element. To reroute a track:

1. Export the new path from Figma — copy the `d` attribute value.
2. Find the reference track `<path>` by its `id` (e.g. `id="flow-track-line"`) in `index.html`.
3. Replace the `d` attribute on **both** the glow track and the solid rail (they share the same geometry).
4. No JavaScript changes are needed — the `<mpath href="#">` reference updates automatically.

### Updating the energy unit shape

1. Export the new shape from Figma as an SVG.
2. Extract the `<path>` elements from inside the Figma SVG.
3. In `index.html`, replace the `<path>` elements inside the inner `<svg>` of each mover group.
4. If the new shape has different dimensions (`width` / `height`), update the centering offset:
   ```
   x = -(new_width  / 2)
   y = -(new_height / 2)
   ```
   Apply this to the `x` and `y` attributes of the inner `<svg>` element.

### Adding a new track

1. Add the reference track `<path>` with a unique `id` and copy the visual rail `<path>` alongside it.
2. Duplicate the mover `<g>` block with new IDs for the group, `<animateMotion>`, and point `<mpath href>` at the new track `id`.
3. Add a `<g class="node-background">` with a base rect and a glow overlay rect to any new nodes, using an appropriate gradient from `<defs>` (or define a new one oriented toward the connection side).
4. Wire up a new JS control function following the pattern of `updateEnergyFlow`, targeting the new mover and `<animateMotion>` IDs.

### Adjusting glow colors

All glow gradient colors are defined in the SVG `<defs>` block:

```html
<linearGradient id="glow-solar" ...>
  <stop offset="0%"   stop-color="#051533"/>  <!-- dark base -->
  <stop offset="100%" stop-color="#0F3F99"/>  <!-- glow color -->
</linearGradient>
```

Change `#0F3F99` to any desired brand color. The base stop should remain `#051533` (the node background color) to ensure a seamless blend.

### Adjusting glow timing

The glow pulse shape is controlled by the `@keyframes` blocks in `src/input.css`. The percentage values control where in the energy unit's travel cycle the glow peaks:

- `glow-pulse-out`: peak at `20%` = just after departure. Increase to delay the flash.
- `glow-pulse-in`: peak at `70%` = just before arrival. Decrease to make the build-up start earlier.

After editing `src/input.css`, rebuild Tailwind:

```bash
npx tailwindcss -i src/input.css -o assets/css/output.min.css --minify
```

---

## 7. Dashboard-Konfiguration (Interactive JS Config API)

The static homepage always shows all three nodes and both tracks. On an interactive dashboard, the visible nodes and active flows must reflect which devices a specific user actually owns and has connected (e.g. no battery → Battery node hidden, grid-battery track hidden). This section documents the required architectural changes and the proposed JavaScript configuration API.

---

### What has to change — and why

#### Problem 1: No addressable wrappers for nodes and tracks

Currently, nodes and tracks have no parent `<g>` element with an ID. JS can reference individual paths and movers, but it cannot toggle an entire node (background + icon) or an entire track (rail + mover) with a single operation.

**Fix:** Wrap every node and every track in a named `<g>` element.

```html
<!-- Node wrapper — controls the entire node: background, glow, icon -->
<g id="node-grid">
  <g class="node-background">...</g>
  <g clip-path="url(#clip1_1002_363)"><!-- icon artwork --></g>
</g>

<!-- Track wrapper — controls the entire track: both rails + mover -->
<g id="track-solar-grid">
  <path id="flow-track-line" .../>          <!-- glow rail -->
  <path d="..." stroke="..." .../>          <!-- solid rail -->
  <g id="main-flow-line" class="energy-unit-mover">...</g>
</g>
```

Apply this to all three nodes and both tracks. No other SVG geometry changes.

---

#### Problem 2: `--flow-speed` on `:root` breaks with multiple independent flow speeds

The static site sets `--flow-speed` on `document.documentElement` so all node glow animations inherit one global value. On a dashboard, the solar→grid flow and the grid→battery flow may run at completely different speeds (e.g. 2 000 W vs 500 W). A single global variable cannot serve both simultaneously.

**Fix:** Set `--flow-speed` directly on each node's wrapper element, not on `:root`. CSS custom properties inherit downward, so the glow `<rect>` inside `#node-solar` will pick up the variable from `#node-solar` itself.

```js
// Instead of: document.documentElement.style.setProperty('--flow-speed', ...)
document.getElementById('node-solar').style.setProperty('--flow-speed', `${speed}s`);
document.getElementById('node-grid').style.setProperty('--flow-speed', `${speed}s`);
```

When a node participates in two flows (Grid is both source and target), set its `--flow-speed` to the speed of whichever flow carries more power, or the most recently updated flow — the difference is typically imperceptible.

---

#### Problem 3: The MutationObserver bridge is hardcoded to one track

The current bridge in `animations.js` is wired to `#main-flow-line` and `#energy-motion-anim` only. A generalized controller writes directly to SMIL attributes for each track, bypassing the need for the bridge entirely on the dashboard.

---

### Required HTML changes (summary)

| Element | Change |
|---|---|
| Each node | Wrap in `<g id="node-{name}">` |
| Each track (both rails + mover) | Wrap in `<g id="track-{name}">` |

No changes to path geometry, gradient definitions, or CSS classes.

---

### CSS addition

Add one utility class for smooth show/hide transitions on nodes and tracks:

```css
.diagram-hidden {
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.5s ease;
}
```

Using `opacity` instead of `display: none` preserves layout space (nodes don't reflow when hidden) and allows CSS transitions. `pointer-events: none` prevents hidden elements from intercepting mouse events.

---

### The `DiagramController`

A static controller class holds the mapping from logical device names to DOM IDs and exposes a clean public API. It writes directly to SMIL attributes — no MutationObserver dependency.

```js
const DiagramController = {

    // Registry: maps logical names → DOM element IDs
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

    // Apply a full device configuration in one call
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

        // Speed: clamp to [0.3s, 6s]
        const speed = Math.max(0.3, Math.min(5000 / Math.abs(watts), 6));

        // Write directly to SMIL attributes (no MutationObserver needed)
        anim.setAttribute('dur', `${speed}s`);
        anim.setAttribute('keyPoints', watts < 0 ? '1;0' : '0;1');

        // Sync node glow animations per-node (not globally on :root)
        const speedVal = `${speed}s`;
        document.getElementById(ids.source)?.style.setProperty('--flow-speed', speedVal);
        document.getElementById(ids.target)?.style.setProperty('--flow-speed', speedVal);
    },
};
```

---

### Configuration object format

```js
DiagramController.apply({
    nodes: {
        solar:   { visible: true  },
        grid:    { visible: true  },
        battery: { visible: false },   // user has no battery storage
    },
    flows: {
        'solar-grid':   { watts: 3200  },   // 3.2 kW flowing forward
        'grid-battery': { watts: null  },   // track hidden — device not connected
    },
});
```

| Flow `watts` value | Behavior |
|---|---|
| `null` / omitted | Track hidden entirely (device not in the user's system) |
| `0` | Track visible but dimmed and paused (device present, no active flow) |
| Positive number | Forward flow at proportional speed |
| Negative number | Reverse flow at proportional speed |

---

### Live updates (real-time data)

For a dashboard that polls or subscribes to live watt readings, call `updateFlow` directly — no need to re-apply the full config:

```js
// Called on every data tick, e.g. every 5 seconds
DiagramController.updateFlow('solar-grid',   liveData.solarWatts);
DiagramController.updateFlow('grid-battery', liveData.batteryWatts);
```

---

### What stays unchanged

The entire animation engine, VFX layer, and glow system remain identical. The `DiagramController` is purely an addressing and control layer on top of the existing structure — it does not replace the SMIL engine, the energy unit shape, or the CSS keyframes. Adding the HTML wrapper groups and per-node `--flow-speed` writes are the only structural changes required to make the static diagram fully configurable.
