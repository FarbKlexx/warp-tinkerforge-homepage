/*
 * ==============================================================================
 * Copyright (c) 2026 coupling media GmbH. All rights reserved.
 * ==============================================================================
 */

let _flowLine = null;

/**
 * Controls the SVG energy flow animation based on current power (watts).
 * Negative values = exporting/discharging (animation runs in reverse).
 * @param {number} powerInWatts
 */
function updateEnergyFlow(powerInWatts) {
    _flowLine ??= document.getElementById("main-flow-line");
    if (!_flowLine) {
        console.warn("updateEnergyFlow: #main-flow-line not found");
        return;
    }

    if (powerInWatts === 0) {
        _flowLine.style.animationPlayState = "paused";
        _flowLine.style.opacity = "0.2";
        return;
    }

    const speed = Math.max(0.3, Math.min(5000 / Math.abs(powerInWatts), 6));
    _flowLine.style.animationPlayState = "running";
    _flowLine.style.opacity = "1";
    _flowLine.style.setProperty("--flow-speed", `${speed}s`);
    _flowLine.style.setProperty("--flow-direction", powerInWatts < 0 ? "reverse" : "normal");
}

document.addEventListener("DOMContentLoaded", () => {
    _flowLine ??= document.getElementById("main-flow-line");
    const motionAnim = document.getElementById("energy-motion-anim");

    if (_flowLine && motionAnim) {
        let prevSpeed = "";
        let prevDir = "";

        // Bridge: syncs CSS custom property changes to SMIL attributes (SMIL cannot read CSS vars)
        const smilBridge = new MutationObserver(() => {
            if (!_flowLine.isConnected) {
                smilBridge.disconnect();
                return;
            }

            const s = _flowLine.style;
            const speed = s.getPropertyValue("--flow-speed").trim();
            const dir = s.getPropertyValue("--flow-direction").trim();

            if (speed && speed !== prevSpeed) {
                motionAnim.setAttribute("dur", speed);
                prevSpeed = speed;
            }
            if (dir && dir !== prevDir) {
                motionAnim.setAttribute("keyPoints", dir === "reverse" ? "1;0" : "0;1");
                prevDir = dir;
            }

            const svg = _flowLine.ownerSVGElement;
            if (!svg) return;
            if (s.animationPlayState === "paused") {
                svg.pauseAnimations();
            } else {
                svg.unpauseAnimations();
            }
        });

        smilBridge.observe(_flowLine, { attributes: true, attributeFilter: ["style"] });
    }

    const scrollObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.remove("opacity-0", "translate-y-10");
                entry.target.classList.add("opacity-100", "translate-y-0");
                scrollObserver.unobserve(entry.target);
            });
        },
        { threshold: 0.15 },
    );

    document.querySelectorAll("section:not(:first-of-type)").forEach((section) => {
        section.classList.add("opacity-0", "translate-y-10", "transition-all", "duration-700");
        scrollObserver.observe(section);
    });
});
