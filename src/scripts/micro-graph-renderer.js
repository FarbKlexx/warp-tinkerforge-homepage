/*
 * MicroGraphRenderer — Zero-Dependency SVG Energy Flow Graph
 *
 * Designed for ESP32 web server deployment (240 MHz, 520 kB RAM).
 * No external dependencies. Single render pass, fluid scaling via CSS.
 *
 * Copyright (c) 2026 coupling media GmbH. All rights reserved.
 */

class MicroGraphRenderer {

    static CELL     = 1000;
    static R        = 300;
    static UNIT_W   = 600;
    static UNIT_H   = 28;
    static TRACK_W  = 14;
    static LABEL_FS = 55;
    static LABEL_OFFSET_Y    = 75;
    static TRACK_GHOST_W     = 0.6;

    static ICON_SCALE        = 1.1;
    static ANIM_DUR_MAX      = 6;
    static ANIM_DUR_MIN      = 0.3;
    static NS       = 'http://www.w3.org/2000/svg';
    static UNIT_SVG_PATH = './assets/images/energy-diagram/energy-unit.svg';
    static ICON_PATH     = './assets/images/energy-diagram/';
    // rx=15 on a 220-wide viewBox in node-base.svg — update if the asset changes
    static NODE_BASE_RX  = 15;
    static NODE_BASE_W   = 220;


    /**
     * @param {string} configPath   – URL to config.json
     * @param {string} containerId  – ID of the host element
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


    constructor(config, containerId) {
        this.config     = config;
        this.container  = document.getElementById(containerId);
        this._svg       = null;
        this._nodeMap   = {};
        this._unitVB    = null;
        this._unitPaths = null;
    }


    async _loadUnitSvg() {
        try {
            const text = await fetch(MicroGraphRenderer.UNIT_SVG_PATH).then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.text();
            });
            const root = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
            // DOMParser never throws — check for parsererror node instead
            if (root.nodeName === 'parsererror') throw new Error('SVG parse error');
            this._unitVB    = root.getAttribute('viewBox') ||
                              `0 0 ${root.getAttribute('width')} ${root.getAttribute('height')}`;
            this._unitPaths = Array.from(root.querySelectorAll('path'));
        } catch (e) {
            console.warn(`MicroGraphRenderer: energy-unit.svg not loaded (${e.message}), using fallback.`);
        }
    }


    _parsePos(str) {
        const m = str.match(/\((\d+),\s*(\d+)\)/);
        if (!m) throw new Error(`Invalid position string: "${str}"`);
        return { col: parseInt(m[1]), row: parseInt(m[2]) };
    }

    _center(posStr) {
        const { col, row } = this._parsePos(posStr);
        const C = MicroGraphRenderer.CELL;
        return { x: col * C + C / 2, y: row * C + C / 2 };
    }


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


    _el(tag, attrs = {}) {
        const el = document.createElementNS(MicroGraphRenderer.NS, tag);
        for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
        return el;
    }


    _speedToDur(speed) {
        const s = Math.max(0, Math.min(1, parseFloat(speed) || 0.5));
        const { ANIM_DUR_MAX: max, ANIM_DUR_MIN: min } = MicroGraphRenderer;
        return (max - s * (max - min)).toFixed(2);
    }

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
            style: 'transform: scale(var(--mg-vfx-scale)); filter: blur(var(--mg-vfx-blur)) drop-shadow(0 0 var(--mg-vfx-glow-near-spread) var(--mg-vfx-glow-near-color)) drop-shadow(0 0 var(--mg-vfx-glow-far-spread) var(--mg-vfx-glow-far-color));',
        });
        const unitSvg = this._el('svg', {
            x:                   -(W / 2),
            y:                   -(H / 2),
            width:               W,
            height:              H,
            viewBox:             this._unitVB || `0 0 ${W} ${H}`,
            preserveAspectRatio: 'none',
        });

        this._unitPaths?.forEach(p => unitSvg.appendChild(p.cloneNode(true)));

        vfx.appendChild(unitSvg);
        mover.appendChild(vfx);
        return mover;
    }


    _buildDefs(svg) {
        const defs = this._el('defs');

        // feFlood+feComposite works on <image> elements regardless of original fill color
        const iconColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--color-dark-primary').trim();
        const iconFilter = this._el('filter', { id: 'mg-icon-color' });
        iconFilter.appendChild(this._el('feFlood', { 'flood-color': iconColor, result: 'color' }));
        iconFilter.appendChild(this._el('feComposite', { in: 'color', in2: 'SourceGraphic', operator: 'in' }));
        defs.appendChild(iconFilter);

        const R  = MicroGraphRenderer.R;
        const D  = R * 2;
        const rx = Math.round(MicroGraphRenderer.NODE_BASE_RX / MicroGraphRenderer.NODE_BASE_W * D);

        this.config.graph.nodes.forEach(node => {
            const { x, y } = this._nodeMap[node.id];
            const clip = this._el('clipPath', { id: `mg-clip-${node.id}` });
            clip.appendChild(this._el('rect', { x: x - R, y: y - R, width: D, height: D, rx }));
            defs.appendChild(clip);
        });

        svg.appendChild(defs);
    }


    /** @returns {MicroGraphRenderer} */
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

        const edgeLayer = this._el('g', { id: 'mg-edge-layer' });
        graph.edges.forEach(edge => {
            const src     = this._nodeMap[edge.source];
            const tgt     = this._nodeMap[edge.target];
            const pathD   = this.getBezierPath(src.x, src.y, tgt.x, tgt.y);
            const trackId = `mg-track-${edge.id}`;
            const active  = edge.status === 'active';

            const group = this._el('g', {
                id:      `mg-edge-${edge.id}`,
                opacity: edge.status === 'inactive' ? '0.5' : '1',
            });

            group.appendChild(this._el('path', {
                d:                pathD,
                class:            'mg-track mg-track-ghost',
                'stroke-width':   String(MicroGraphRenderer.TRACK_W * MicroGraphRenderer.TRACK_GHOST_W),
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

            if (active) group.appendChild(this._buildMover(edge, trackId, edge.speed));
            edgeLayer.appendChild(group);
        });
        svg.appendChild(edgeLayer);

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
                const s     = R * MicroGraphRenderer.ICON_SCALE;
                const imgEl = this._el('image', {
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
                x,
                y:                y + R + MicroGraphRenderer.LABEL_OFFSET_Y,
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

        this.container.replaceChildren(svg);
        return this;
    }


    _setVisible(prefix, id, visible) {
        const el = this._svg?.querySelector(`#mg-${prefix}-${id}`);
        if (el) el.setAttribute('opacity', visible ? '1' : '0');
    }

    setNodeVisible(nodeId, visible) {
        this._setVisible('node', nodeId, visible);
    }

    setEdgeVisible(edgeId, visible) {
        this._setVisible('edge', edgeId, visible);
    }

    /**
     * @param {Object} config
     * @param {Object} [config.nodes]  – { "n01": { visible: true }, ... }
     * @param {Object} [config.flows]  – { "e01": { visible: true }, ... }
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
