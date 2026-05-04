/*
 * ==============================================================================
 * MicroGraphRenderer — Zero-Dependency SVG Energy Flow Graph
 * ==============================================================================
 * Läuft direkt auf einem ESP32-Webserver (240 MHz, 520 kB RAM).
 * Keine externen Libraries. Einmaliges Rendern beim Laden, fluid Scaling via CSS.
 *
 * Copyright (c) 2026 coupling media GmbH. All rights reserved.
 * ==============================================================================
 */

class MicroGraphRenderer {

    // ==========================================================================
    // Klassenkonstanten — Alle Maße in SVG-Einheiten (interne Koordinaten)
    // ==========================================================================

    /** Kantenlänge einer Gitterzelle. 3×3-Gitter → viewBox "0 0 3000 3000" */
    static CELL     = 1000;

    /** Radius der Node-Kreise */
    static R        = 300;

    /**
     * Render-Dimensionen der Energie-Einheit (Komet) im SVG-Koordinatensystem.
     * Wenn energy-unit.svg geladen wird, skaliert das innere <svg> via
     * viewBox + preserveAspectRatio="none" auf genau diese Maße.
     */
    static UNIT_W   = 600;
    static UNIT_H   = 28;

    /** Breite der Energie-Pfad-Linien */
    static TRACK_W  = 14;

    /** Schriftgröße der Node-Labels */
    static LABEL_FS = 55;

    /** SVG-Namespace — zwingend für document.createElementNS */
    static NS       = 'http://www.w3.org/2000/svg';

    /** Pfad zur Energie-Einheit relativ zum HTML-Dokument */
    static UNIT_SVG_PATH = './assets/images/energy-diagram/energy-unit.svg';

    /** Basis-Pfad für Node-Icons relativ zum HTML-Dokument */
    static ICON_PATH     = './assets/images/energy-diagram/';


    // ==========================================================================
    // Statische Factory — lädt Config-JSON + Energie-Einheit vor dem Rendern
    // ==========================================================================

    /**
     * Bevorzugter Einstiegspunkt.
     * Lädt die Graph-Konfiguration aus einer JSON-Datei und die SVG-Datei
     * der Energie-Einheit, dann gibt eine fertige Renderer-Instanz zurück.
     *
     * @param {string} configPath   – URL/Pfad zur config.json
     * @param {string} containerId  – ID des HTML-Elements für das SVG
     * @returns {Promise<MicroGraphRenderer>}
     */
    static async create(configPath, containerId) {
        const config = await fetch(configPath, { cache: 'no-store' }).then(r => {
            if (!r.ok) throw new Error(`Config fetch failed: HTTP ${r.status}`);
            return r.json();
        });

        const renderer = new MicroGraphRenderer(config, containerId);
        await renderer._loadUnitSvg();
        return renderer;
    }


    // ==========================================================================
    // Konstruktor
    // ==========================================================================

    /**
     * Direkte Instantiierung mit bereits geparster Konfiguration.
     * Für das Laden aus einer Datei stattdessen MicroGraphRenderer.create() nutzen.
     *
     * @param {Object} config       – Graph-Konfiguration
     * @param {string} containerId  – ID des Container-Elements
     */
    constructor(config, containerId) {
        this.config    = config;
        this.container = document.getElementById(containerId);

        /** @type {SVGSVGElement|null} */
        this._svg     = null;

        /** Vorberechnete Node-Mittelpunkte: nodeId → { x, y, node } */
        this._nodeMap = {};

        /** viewBox-String der energy-unit.svg (z.B. "0 0 295 13"), null = Fallback */
        this._unitVB    = null;

        /** Geklonte <path>-Elemente aus energy-unit.svg, null = Fallback */
        this._unitPaths = null;

    }


    // ==========================================================================
    // Energie-Einheit SVG laden
    // ==========================================================================

    /**
     * Fetcht energy-unit.svg und speichert viewBox + Pfade für _buildMover().
     * Bei Fehler wird stumm auf die programmatischen Fallback-Pfade zurückgefallen.
     */
    async _loadUnitSvg() {
        try {
            const text = await fetch(MicroGraphRenderer.UNIT_SVG_PATH).then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.text();
            });

            const parser = new DOMParser();
            const doc    = parser.parseFromString(text, 'image/svg+xml');
            const root   = doc.documentElement;

            // Auf Parse-Fehler prüfen (DOMParser wirft keine Exceptions)
            if (root.nodeName === 'parsererror') throw new Error('SVG parse error');

            this._unitVB    = root.getAttribute('viewBox') ||
                              `0 0 ${root.getAttribute('width')} ${root.getAttribute('height')}`;

            // Nur <path>-Elemente — überspringt <g clip-path="..."> und <defs>
            this._unitPaths = Array.from(root.querySelectorAll('path'));

        } catch (e) {
            console.warn(`MicroGraphRenderer: energy-unit.svg not loaded (${e.message}), using fallback.`);
        }
    }


    // ==========================================================================
    // Positions-Parsing & Koordinaten-Berechnung
    // ==========================================================================

    /**
     * Parst den Positions-String "(col,row)" → { col, row }.
     * Beispiel: "(1,2)" → { col: 1, row: 2 }
     */
    _parsePos(str) {
        const m = str.match(/\((\d+),\s*(\d+)\)/);
        if (!m) throw new Error(`Ungültiger Positions-String: "${str}"`);
        return { col: parseInt(m[1]), row: parseInt(m[2]) };
    }

    /**
     * Berechnet den SVG-Mittelpunkt einer Gitterzelle.
     *   x = col × CELL + CELL / 2
     *   y = row × CELL + CELL / 2
     */
    _center(posStr) {
        const { col, row } = this._parsePos(posStr);
        const C = MicroGraphRenderer.CELL;
        return { x: col * C + C / 2, y: row * C + C / 2 };
    }


    // ==========================================================================
    // Bézier-Kurven-Berechnung
    // ==========================================================================

    /**
     * Erzeugt einen kubischen Bézier-Pfad (S-Kurve) zwischen zwei Mittelpunkten.
     * Kontrollpunkte werden entlang der dominanten Achse versetzt, sodass die
     * Kurve waagerecht/senkrecht aus den Nodes herausführt und einbiegt.
     */
    getBezierPath(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        let cx1, cy1, cx2, cy2;

        if (Math.abs(dx) >= Math.abs(dy)) {
            cx1 = x1 + dx * 0.5;  cy1 = y1;
            cx2 = x2 - dx * 0.5;  cy2 = y2;
        } else {
            cx1 = x1;  cy1 = y1 + dy * 0.5;
            cx2 = x2;  cy2 = y2 - dy * 0.5;
        }

        return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
    }


    // ==========================================================================
    // SVG-Element-Fabrik
    // ==========================================================================

    /** createElementNS-Kurzform mit sofortiger Attribut-Zuweisung. */
    _el(tag, attrs = {}) {
        const el = document.createElementNS(MicroGraphRenderer.NS, tag);
        for (const [k, v] of Object.entries(attrs)) {
            el.setAttribute(k, v);
        }
        return el;
    }


    // ==========================================================================
    // Komet-Form (programmatische Fallback-Pfade)
    // ==========================================================================

    /**
     * Skaliert den Kometen-Körper (Cyan #05B4FF) auf beliebige Dimensionen.
     * Normalisierungsbasis: Original-Figma-Export 295×13 px.
     * Wird nur verwendet, wenn energy-unit.svg nicht geladen werden konnte.
     */
    _cometBody(W, H) {
        const x = v => (v / 295 * W).toFixed(1);
        const y = v => (v / 13  * H).toFixed(1);
        return (
            `M${x(295)} ${y(7.29)} ` +
            `L${x(63.85)} ${y(13)} L${x(60.69)} ${y(12.99)} ` +
            `C${x(44.90)} ${y(12.91)} ${x(29.93)} ${y(12.24)} ${x(18.70)} ${y(11.10)} ` +
            `C${x(6.73)} ${y(9.88)} 0 ${y(8.22)} 0 ${y(6.5)} ` +
            `C0 ${y(4.78)} ${x(6.73)} ${y(3.12)} ${x(18.70)} ${y(1.90)} ` +
            `C${x(30.68)} ${y(0.69)} ${x(46.92)} 0 ${x(63.85)} 0 ` +
            `L${x(295)} ${y(7.29)}Z`
        );
    }

    /** Skaliert das weiße Highlight-Overlay. Nur für Fallback. */
    _cometHighlight(W, H) {
        const x = v => (v / 295 * W).toFixed(1);
        const y = v => (v / 13  * H).toFixed(1);
        return (
            `M${x(209)} ${y(7.05)} ` +
            `L${x(51.5)} ${y(11)} L${x(49.35)} ${y(10.99)} ` +
            `C${x(38.60)} ${y(10.94)} ${x(28.39)} ${y(10.47)} ${x(20.74)} ${y(9.68)} ` +
            `C${x(12.58)} ${y(8.84)} ${x(8)} ${y(7.69)} ${x(8)} ${y(6.5)} ` +
            `C${x(8)} ${y(5.31)} ${x(12.58)} ${y(4.16)} ${x(20.74)} ${y(3.32)} ` +
            `C${x(28.90)} ${y(2.47)} ${x(39.97)} ${y(2)} ${x(51.5)} ${y(2)} ` +
            `L${x(209)} ${y(7.05)}Z`
        );
    }


    // ==========================================================================
    // Mover-Gruppe (SMIL-Animation + Komet-VFX)
    // ==========================================================================

    /**
     * Konvertiert einen Geschwindigkeitswert (0–1) in eine Animationsdauer.
     *   speed=0 → 6 s (sehr langsam)
     *   speed=1 → 0.3 s (sehr schnell)
     */
    _speedToDur(speed) {
        const s = Math.max(0, Math.min(1, parseFloat(speed) || 0.5));
        return (6 - s * 5.7).toFixed(2);
    }

    /**
     * Baut die Mover-Gruppe für eine aktive Kante.
     *
     * Wenn energy-unit.svg geladen wurde, werden die echten SVG-Pfade als
     * geklonte Elemente eingebettet. Andernfalls greifen die Fallback-Pfade.
     *
     * Struktur:
     *   <g id="mg-mover-{edgeId}">
     *     <animateMotion ...><mpath href="#{trackPathId}"/></animateMotion>
     *     <g transform="scale(0.65)" style="filter:...">
     *       <svg x="-W/2" y="-H/2" width="W" height="H" viewBox="..." preserveAspectRatio="none">
     *         [paths aus energy-unit.svg  –oder–  Fallback-Pfade]
     *       </svg>
     *     </g>
     *   </g>
     *
     * @param {Object} edge
     * @param {string} trackPathId
     * @param {number} [speed=0.5]  – 0 (langsam) … 1 (schnell)
     */
    _buildMover(edge, trackPathId, speed = 0.5) {
        const W = MicroGraphRenderer.UNIT_W;
        const H = MicroGraphRenderer.UNIT_H;

        const mover = this._el('g', { id: `mg-mover-${edge.id}`, class: 'energy-unit-mover' });

        const anim = this._el('animateMotion', {
            id:          `mg-anim-${edge.id}`,
            dur:         `${this._speedToDur(speed)}s`,
            repeatCount: 'indefinite',
            rotate:      'auto-reverse',
            keyPoints:   '0;1',
            keyTimes:    '0;1',
            calcMode:    'linear',
        });
        const mpath = this._el('mpath');
        mpath.setAttribute('href', `#${trackPathId}`);
        anim.appendChild(mpath);
        mover.appendChild(anim);

        const vfx = this._el('g', {
            transform: 'scale(0.65)',
            style: 'filter: blur(2px) drop-shadow(0 0 20px rgba(5,180,255,0.9)) drop-shadow(0 0 40px #5384FF);',
        });

        const unitSvg = this._el('svg', {
            x:                   -(W / 2),
            y:                   -(H / 2),
            width:               W,
            height:              H,
            viewBox:             this._unitVB || `0 0 ${W} ${H}`,
            preserveAspectRatio: 'none',
        });

        if (this._unitPaths && this._unitPaths.length > 0) {
            this._unitPaths.forEach(p => unitSvg.appendChild(p.cloneNode(true)));
        } else {
            unitSvg.appendChild(this._el('path', { fill: '#05B4FF', d: this._cometBody(W, H) }));
            unitSvg.appendChild(this._el('path', { fill: 'white',   d: this._cometHighlight(W, H) }));
        }

        vfx.appendChild(unitSvg);
        mover.appendChild(vfx);

        return mover;
    }


    // ==========================================================================
    // SVG <defs>: Gradienten & Clip-Paths
    // ==========================================================================

    _buildDefs(svg) {
        const defs = this._el('defs');

        // feFlood+feComposite: flood target color, mask by source alpha.
        // Works reliably on <image> elements regardless of original fill color.
        const iconColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--color-dark-primary').trim() || '#051533';
        const iconFilter = this._el('filter', { id: 'mg-icon-color' });
        const flood = this._el('feFlood', { 'flood-color': iconColor, result: 'color' });
        const composite = this._el('feComposite', { in: 'color', in2: 'SourceGraphic', operator: 'in' });
        iconFilter.appendChild(flood);
        iconFilter.appendChild(composite);
        defs.appendChild(iconFilter);

        const R = MicroGraphRenderer.R;
        const D = R * 2;
        // rx proportional to node-base.svg (rx=15 on a 220-wide viewBox)
        const rx = Math.round(15 / 220 * D);

        this.config.graph.nodes.forEach(node => {
            const { x, y } = this._nodeMap[node.id];
            const clip = this._el('clipPath', { id: `mg-clip-${node.id}` });
            clip.appendChild(this._el('rect', {
                x: x - R, y: y - R, width: D, height: D, rx,
            }));
            defs.appendChild(clip);
        });

        svg.appendChild(defs);
    }


    // ==========================================================================
    // Haupt-Render
    // ==========================================================================

    /**
     * Erzeugt das komplette SVG-Diagramm und hängt es in den Container ein.
     * Nur einmal aufrufen — kein resize-Listener nötig.
     *
     * Render-Reihenfolge:
     *   1. <defs>   – Gradienten, Clip-Paths
     *   2. Kanten   – Pfade + Energie-Einheiten (hinter den Nodes)
     *   3. Nodes    – Kreise, Icons, Labels
     *
     * @returns {MicroGraphRenderer} this (für Method Chaining)
     */
    render() {
        const { grid, graph } = this.config;
        const cols = parseInt(grid.width);
        const rows = parseInt(grid.height);
        const C    = MicroGraphRenderer.CELL;

        graph.nodes.forEach(node => {
            this._nodeMap[node.id] = { ...this._center(node.position), node };
        });

        const svg = this._el('svg', {
            viewBox:      `0 0 ${cols * C} ${rows * C}`,
            xmlns:        MicroGraphRenderer.NS,
            class:        'w-full h-auto',
            role:         'img',
            'aria-label': 'Energie-Fluss-Diagramm',
        });
        this._svg = svg;
        this._buildDefs(svg);

        // ── Kanten ───────────────────────────────────────────────────────────
        const edgeLayer = this._el('g', { id: 'mg-edge-layer' });

        graph.edges.forEach(edge => {
            const src     = this._nodeMap[edge.source];
            const tgt     = this._nodeMap[edge.target];
            const pathD   = this.getBezierPath(src.x, src.y, tgt.x, tgt.y);
            const trackId = `mg-track-${edge.id}`;
            const active   = edge.status === 'active';
            const inactive = edge.status === 'inactive';

            const group = this._el('g', {
                id:      `mg-edge-${edge.id}`,
                opacity: inactive ? '0.5' : '1',
            });

            group.appendChild(this._el('path', {
                d:                pathD,
                class:            'mg-track',
                'stroke-width':   String(MicroGraphRenderer.TRACK_W * 0.6),
                'stroke-opacity': '0.15',
                'stroke-linecap': 'round',
                fill:             'none',
            }));

            group.appendChild(this._el('path', {
                id:               trackId,
                d:                pathD,
                class:            'mg-track',
                'stroke-width':   String(MicroGraphRenderer.TRACK_W),
                'stroke-linecap': 'round',
                fill:             'none',
            }));

            if (active) {
                group.appendChild(this._buildMover(edge, trackId, edge.speed));
            }

            edgeLayer.appendChild(group);
        });

        svg.appendChild(edgeLayer);

        // ── Nodes ────────────────────────────────────────────────────────────
        const nodeLayer = this._el('g', { id: 'mg-node-layer' });

        graph.nodes.forEach(node => {
            const { x, y } = this._nodeMap[node.id];
            const R        = MicroGraphRenderer.R;
            const group    = this._el('g', { id: `mg-node-${node.id}` });

            group.appendChild(this._el('image', {
                href:                `${MicroGraphRenderer.ICON_PATH}node-base.svg`,
                x:                   x - R,
                y:                   y - R,
                width:               R * 2,
                height:              R * 2,
                preserveAspectRatio: 'xMidYMid meet',
            }));

            if (node.icon) {
                const s      = R * 1.1;
                const imgEl  = this._el('image', {
                    href:                `${MicroGraphRenderer.ICON_PATH}${node.icon}`,
                    x:                   x - s / 2,
                    y:                   y - s / 2,
                    width:               s,
                    height:              s,
                    preserveAspectRatio: 'xMidYMid meet',
                    'clip-path':         `url(#mg-clip-${node.id})`,
                    filter:              'url(#mg-icon-color)',
                });
                imgEl.addEventListener('error', () => imgEl.remove());
                group.appendChild(imgEl);
            }

            const label = this._el('text', {
                x:                x,
                y:                y + R + 75,
                'text-anchor':    'middle',
                'font-family':    'system-ui, -apple-system, sans-serif',
                'font-size':      String(MicroGraphRenderer.LABEL_FS),
                'font-weight':    '600',
                'letter-spacing': '1',
                class:            'mg-label',
            });
            label.textContent = node.label;
            group.appendChild(label);

            nodeLayer.appendChild(group);
        });

        svg.appendChild(nodeLayer);

        this.container.innerHTML = '';
        this.container.appendChild(svg);

        return this;
    }


    // ==========================================================================
    // Steuerungs-API
    // ==========================================================================

    /**
     * Blendet einen Node ein oder aus.
     * @param {string}  nodeId
     * @param {boolean} visible
     */
    setNodeVisible(nodeId, visible) {
        const el = document.getElementById(`mg-node-${nodeId}`);
        if (el) el.setAttribute('opacity', visible ? '1' : '0');
    }

    /**
     * Blendet eine Kante ein oder aus.
     * @param {string}  edgeId
     * @param {boolean} visible
     */
    setEdgeVisible(edgeId, visible) {
        const el = document.getElementById(`mg-edge-${edgeId}`);
        if (el) el.setAttribute('opacity', visible ? '1' : '0');
    }

    /**
     * Wendet Sichtbarkeitsänderungen für Nodes und Kanten an.
     * Geschwindigkeiten kommen ausschließlich aus der config.json.
     *
     * @param {Object} config
     * @param {Object} [config.nodes]  – { "n01": { visible: true }, ... }
     * @param {Object} [config.flows]  – { "e01": { visible: true }, "e02": { visible: false }, ... }
     */
    applyConfig(config) {
        for (const [id, opts] of Object.entries(config.nodes ?? {})) {
            this.setNodeVisible(id, opts.visible ?? true);
        }
        for (const [id, opts] of Object.entries(config.flows ?? {})) {
            this.setEdgeVisible(id, opts.visible ?? true);
        }
    }
}
