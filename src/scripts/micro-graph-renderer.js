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

    static ANIM_DUR_MAX      = 6;
    static ANIM_DUR_MIN      = 0.3;
    static NS    = 'http://www.w3.org/2000/svg';
    static XHTML = 'http://www.w3.org/1999/xhtml';
    static UNIT_SVG_PATH = './assets/images/energy-diagram/energy-unit.svg';
    static ICON_PATH     = './assets/images/energy-diagram/';


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

        // Diagonal connection — straight line so the energy unit travels without rotation artefacts
        if (dx !== 0 && dy !== 0) {
            return `M ${x1} ${y1} L ${x2} ${y2}`;
        }

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

    _buildMover(edge, trackPathEl, speed = 0.5) {
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
        mpath.setAttribute('href', `#${trackPathEl.id}`);
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
            viewBox:      `0 0 ${cols * C} ${rows * C + 300}`,
            xmlns:        MicroGraphRenderer.NS,
            class:        'w-full h-auto',
            overflow:     'visible',
            role:         'img',
            'aria-label': 'Energie-Fluss-Diagramm',
        });
        this._svg = svg;

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
            const trackEl = this._el('path', {
                id:               trackId,
                d:                pathD,
                class:            'mg-track',
                'stroke-width':   String(MicroGraphRenderer.TRACK_W),
                'stroke-linecap': 'round',
                fill:             'none',
            });
            group.appendChild(trackEl);

            if (active) group.appendChild(this._buildMover(edge, trackEl, edge.speed));
            edgeLayer.appendChild(group);
        });
        svg.appendChild(edgeLayer);

        const nodeLayer = this._el('g', { id: 'mg-node-layer' });
        graph.nodes.forEach(node => {
            const { x, y } = this._nodeMap[node.id];
            const R        = MicroGraphRenderer.R;
            const group    = this._el('g', { id: `mg-node-${node.id}` });

            // Expand foreignObject by BLEED on all sides so box-shadow isn't clipped.
            // A transparent wrapper with matching padding re-centers the visible content.
            const BLEED   = 300;
            const fo      = this._el('foreignObject', {
                x:        x - R - BLEED,
                y:        y - R - BLEED,
                width:    (R + BLEED) * 2,
                height:   (R + BLEED) * 2,
                overflow: 'visible',
            });
            const XHTML   = MicroGraphRenderer.XHTML;
            const wrapper = document.createElementNS(XHTML, 'div');
            wrapper.setAttribute('xmlns', XHTML);
            wrapper.style.cssText = `width:100%;height:100%;padding:${BLEED}px;box-sizing:border-box;pointer-events:none;`;
            const outer = document.createElementNS(XHTML, 'div');
            outer.className = 'mg-node-outer';
            outer.style.pointerEvents = 'auto';
            const inner = document.createElementNS(XHTML, 'div');
            inner.className = 'mg-node-inner';
            if (node.icon) {
                const img = document.createElementNS(XHTML, 'img');
                img.setAttribute('src', `${MicroGraphRenderer.ICON_PATH}${node.icon}`);
                img.setAttribute('alt', '');
                img.className = 'mg-node-icon';
                inner.appendChild(img);
            }
            outer.appendChild(inner);
            wrapper.appendChild(outer);
            fo.appendChild(wrapper);
            group.appendChild(fo);

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
