/*
 * ==============================================================================
 * Copyright (c) 2026 coupling media GmbH. All rights reserved.
 * * This source code was designed and developed by coupling media GmbH
 * on behalf of Tinkerforge GmbH.
 * ==============================================================================
 */

/**
 * Controls the SVG energy flow animation based on current power (watts).
 * Negative values = exporting/discharging (animation runs in reverse).
 * @param {number} powerInWatts
 */
function updateEnergyFlow(powerInWatts) {
    const flowLine = document.getElementById('main-flow-line');

    if (!flowLine) {
        console.warn('Energy Flow Line not found!');
        return;
    }

    if (powerInWatts === 0) {
        flowLine.style.animationPlayState = 'paused';
        flowLine.style.opacity = '0.2';
        return;
    }

    flowLine.style.animationPlayState = 'running';
    flowLine.style.opacity = '1';

    let speed = 5000 / Math.abs(powerInWatts);
    speed = Math.max(0.3, Math.min(speed, 6));
    flowLine.style.setProperty('--flow-speed', `${speed}s`);
    document.documentElement.style.setProperty('--flow-speed', `${speed}s`);

    flowLine.style.setProperty('--flow-direction', powerInWatts < 0 ? 'reverse' : 'normal');
}

document.addEventListener("DOMContentLoaded", () => {
    // Bridge: syncs CSS variable changes written by updateEnergyFlow onto the
    // <animateMotion> element, which only accepts SMIL attributes (not CSS vars).
    const mover      = document.getElementById('main-flow-line');
    const motionAnim = document.getElementById('energy-motion-anim');

    if (mover && motionAnim) {
        new MutationObserver(() => {
            const s     = mover.style;
            const speed = s.getPropertyValue('--flow-speed').trim();
            const dir   = s.getPropertyValue('--flow-direction').trim();

            if (speed) motionAnim.setAttribute('dur', speed);
            if (dir)   motionAnim.setAttribute('keyPoints', dir === 'reverse' ? '1;0' : '0;1');

            // Pause/resume the SVG's SMIL timeline to mirror animationPlayState
            const svg = mover.ownerSVGElement;
            if (!svg) return;
            if (s.animationPlayState === 'paused') {
                svg.pauseAnimations();
            } else {
                svg.unpauseAnimations();
            }
        }).observe(mover, { attributes: true, attributeFilter: ['style'] });
    }

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.remove("opacity-0", "translate-y-10");
                    entry.target.classList.add("opacity-100", "translate-y-0");
                    observer.unobserve(entry.target);
                }
            });
        },
        {
            threshold: 0.15,
        },
    );

    const sections = document.querySelectorAll("section:not(:first-of-type)");
    sections.forEach((section) => {
        section.classList.add("opacity-0", "translate-y-10", "transition-all", "duration-700");
        observer.observe(section);
    });
});
