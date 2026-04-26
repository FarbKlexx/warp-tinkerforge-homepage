/*
 * ==============================================================================
 * Copyright (c) 2026 Tinkerforge GmbH. All rights reserved.
 * * This source code was designed and developed by coupling media GmbH
 * on behalf of Tinkerforge GmbH.
 * ==============================================================================
 */

document.addEventListener("DOMContentLoaded", () => {
    // Scroll Showcase mobile/tablet image slider
    const showcaseTrack = document.getElementById("showcase-slider-track");
    const showcaseDots = Array.from(document.querySelectorAll("[data-showcase-dot]"));

    if (showcaseTrack && showcaseDots.length) {
        const slideCount = showcaseDots.length;
        let activeIndex = 0;
        let autoplayTimer = null;

        const updateDots = (index) => {
            activeIndex = index;
            showcaseDots.forEach((dot, i) => {
                if (i === index) {
                    dot.classList.add("bg-white", "scale-125");
                    dot.classList.remove("bg-white/45");
                } else {
                    dot.classList.add("bg-white/45");
                    dot.classList.remove("bg-white", "scale-125");
                }
            });
        };

        const goToSlide = (index, smooth = true) => {
            showcaseTrack.scrollTo({
                left: showcaseTrack.offsetWidth * index,
                behavior: smooth ? "smooth" : "instant",
            });
            updateDots(index);
        };

        const startAutoplay = () => {
            stopAutoplay();
            autoplayTimer = setInterval(() => {
                goToSlide((activeIndex + 1) % slideCount);
            }, 4000);
        };

        const stopAutoplay = () => clearInterval(autoplayTimer);

        showcaseTrack.addEventListener(
            "scroll",
            () => {
                const index = Math.round(showcaseTrack.scrollLeft / showcaseTrack.offsetWidth);
                updateDots(index);
            },
            { passive: true },
        );

        showcaseTrack.addEventListener("touchstart", () => stopAutoplay(), { passive: true });
        showcaseTrack.addEventListener("touchend", () => startAutoplay(), { passive: true });

        showcaseDots.forEach((dot) => {
            dot.addEventListener("click", () => {
                goToSlide(parseInt(dot.dataset.showcaseDot, 10));
                startAutoplay();
            });
        });

        startAutoplay();
    }

    const sliderNav = document.querySelector('nav[aria-label="Slider tabs"]');
    if (!sliderNav) return;

    const tabs = Array.from(sliderNav.querySelectorAll("button"));

    const sliderImage = document.getElementById("slider-image");
    const sliderImageBg = document.getElementById("slider-image-bg");
    const sliderBadge = document.getElementById("slider-badge");
    const sliderHeadline = document.getElementById("slider-headline");
    const sliderBody = document.getElementById("slider-body");
    const sliderTextContent = document.getElementById("slider-text-content");
    const sliderMehrBtn = document.getElementById("slider-mehr-btn");
    const sliderArticle = sliderTextContent?.closest("article");

    const tabData = [
        {
            badge: "NEU",
            headline: "Bereit für die nächste Generation des Ladens.",
            body: "Der WARP4 unterstützt den Kommunikationsstandard ISO 15118 und ist damit hardwareseitig für bidirektionales Laden vorbereitet, um Ihr Fahrzeug künftig als Energiespeicher nutzen zu können. Zudem ermöglicht die erweiterte Kommunikation das direkte Auslesen des Fahrzeug-Ladestands (SoC), wodurch sich Ladevorgänge und das eigene Energiemanagement noch präziser steuern lassen.",
            image: "./assets/images/img-placeholder-1.png",
        },
        {
            badge: "",
            headline: "Laden ohne Stecken und Tippen.",
            body: "Mit Autocharge erkennt die Wallbox Ihr Fahrzeug automatisch und startet den Ladevorgang sofort. Kein RFID-Chip, keine App – einfach einstecken und laden.",
            image: "./assets/images/img-placeholder-2.png",
        },
        {
            badge: "",
            headline: "Zeitloses Design für jede Umgebung.",
            body: "Das moderne Gehäusedesign des WARP4 Charger fügt sich harmonisch in jede Umgebung ein. Pulverbeschichtetes Metall und ein klares, minimalistisches Layout machen es zur ästhetischen Ergänzung Ihrer Garage oder Einfahrt.",
            image: "./assets/images/img-placeholder-3.png",
        },
    ];

    if (!sliderImage || !sliderHeadline || !sliderBody) return;

    // ── Mobile "mehr anzeigen" ─────────────────────────────────────────────

    let bodyExpanded = false;
    let isAnimating = false;
    let savedClampedHeight = 0;

    const isMobile = () => window.innerWidth < 768;

    function applyClamp() {
        sliderBody.style.display = "-webkit-box";
        sliderBody.style.webkitLineClamp = "4";
        sliderBody.style.webkitBoxOrient = "vertical";
        sliderBody.style.overflow = "hidden";
        sliderBody.style.maxHeight = "";
    }

    function checkMehrAnzeigen() {
        if (!sliderMehrBtn) return;
        if (!isMobile()) {
            sliderMehrBtn.classList.add("hidden");
            sliderBody.style.display =
                sliderBody.style.webkitLineClamp =
                sliderBody.style.webkitBoxOrient =
                sliderBody.style.overflow =
                sliderBody.style.maxHeight =
                    "";
            return;
        }
        applyClamp();
        sliderMehrBtn.classList.toggle(
            "hidden",
            sliderBody.scrollHeight <= sliderBody.clientHeight + 1,
        );
    }

    // Returns the max height the body can grow to before it would overflow the image.
    // justify-end keeps items at bottom; body growing pushes siblings upward naturally.
    function getAvailableBodyHeight() {
        const style = getComputedStyle(sliderTextContent);
        const pt = parseFloat(style.paddingTop) || 0;
        const pb = parseFloat(style.paddingBottom) || 0;
        const gap = parseFloat(style.rowGap) || 12;
        const innerH = sliderTextContent.clientHeight - pt - pb;

        let siblingsH = 0;
        let count = 0;
        for (const child of sliderTextContent.children) {
            if (child === sliderBody) continue;
            if (getComputedStyle(child).display === "none") continue;
            siblingsH += child.offsetHeight;
            count++;
        }
        // count visible siblings → count gaps between body and each of them
        return innerH - siblingsH - count * gap;
    }

    function resetBodyStyles() {
        sliderBody.style.transition = "";
        sliderBody.style.maxHeight = "";
        sliderBody.style.overflow = "";
        sliderBody.style.overflowY = "";
        sliderBody.style.display = "";
        sliderBody.style.webkitLineClamp = "";
        sliderBody.style.webkitBoxOrient = "";
        if (sliderArticle) sliderArticle.style.height = "";
    }

    // Instant reset (tab switch / resize — no animation)
    function collapseBodyImmediate() {
        isAnimating = false;
        bodyExpanded = false;
        resetBodyStyles();
        if (sliderMehrBtn) sliderMehrBtn.textContent = "mehr anzeigen";
        checkMehrAnzeigen();
    }

    function expandBody() {
        if (isAnimating) return;
        isAnimating = true;
        bodyExpanded = true;

        // Capture the 4-line height before removing clamp
        savedClampedHeight = sliderBody.clientHeight;

        // Lock the article so the image never resizes
        if (sliderArticle) sliderArticle.style.height = sliderArticle.offsetHeight + "px";

        // Switch from webkit-box to block while staying at the same visual height
        sliderBody.style.maxHeight = savedClampedHeight + "px";
        sliderBody.style.overflow = "hidden";
        sliderBody.style.display = "block";
        sliderBody.style.webkitLineClamp = "";
        sliderBody.style.webkitBoxOrient = "";

        // Measure how tall the full text is and how much space is actually available
        const naturalHeight = sliderBody.scrollHeight;
        const available = getAvailableBodyHeight();
        const targetHeight = Math.min(naturalHeight, available);
        const needsScroll = naturalHeight > available;

        if (sliderMehrBtn) sliderMehrBtn.textContent = "weniger anzeigen";

        // Two rAFs: first registers the initial height, second starts the transition
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                sliderBody.style.transition = "max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1)";
                sliderBody.style.maxHeight = targetHeight + "px";
                sliderBody.addEventListener(
                    "transitionend",
                    () => {
                        sliderBody.style.transition = "";
                        if (needsScroll) sliderBody.style.overflowY = "auto";
                        isAnimating = false;
                    },
                    { once: true },
                );
            });
        });
    }

    function collapseBody() {
        if (isAnimating) return;
        isAnimating = true;
        bodyExpanded = false;

        // Hide scrollbar during collapse
        sliderBody.style.overflowY = "";
        sliderBody.style.overflow = "hidden";

        if (sliderMehrBtn) sliderMehrBtn.textContent = "mehr anzeigen";

        sliderBody.style.transition = "max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1)";
        sliderBody.style.maxHeight = savedClampedHeight + "px";

        sliderBody.addEventListener(
            "transitionend",
            () => {
                sliderBody.style.transition = "";
                if (sliderArticle) sliderArticle.style.height = "";
                // Re-apply clamp (shows "…") and re-evaluate button visibility
                checkMehrAnzeigen();
                isAnimating = false;
            },
            { once: true },
        );
    }

    if (sliderMehrBtn) {
        sliderMehrBtn.addEventListener("click", () => {
            bodyExpanded ? collapseBody() : expandBody();
        });
    }

    checkMehrAnzeigen();
    window.addEventListener("resize", collapseBodyImmediate, { passive: true });

    // ── Tab switching ──────────────────────────────────────────────────────

    let transitionTimeout;

    tabs.forEach((tab, index) => {
        tab.addEventListener("click", () => {
            tabs.forEach((t, i) => {
                if (i === index) {
                    t.setAttribute("aria-selected", "true");
                    t.classList.add("bg-white/30");
                    t.classList.remove("hover:bg-white/10");
                } else {
                    t.setAttribute("aria-selected", "false");
                    t.classList.remove("bg-white/30");
                    t.classList.add("hover:bg-white/10");
                }
            });

            const data = tabData[index];

            if (sliderImageBg) {
                clearTimeout(transitionTimeout);
                sliderImageBg.src = data.image;
                sliderImage.style.transition = "";
                sliderImage.style.opacity = "0";

                transitionTimeout = setTimeout(() => {
                    sliderImage.style.transition = "none";
                    sliderImage.src = data.image;
                    sliderImage.alt = data.headline;
                    sliderImage.style.opacity = "1";
                    void sliderImage.offsetWidth;
                    sliderImage.style.transition = "";
                }, 300);
            }

            sliderHeadline.textContent = data.headline;
            sliderBody.textContent = data.body;

            if (sliderBadge) {
                if (data.badge) {
                    sliderBadge.textContent = data.badge;
                    sliderBadge.style.display = "block";
                } else {
                    sliderBadge.style.display = "none";
                }
            }

            // Always reset expand state on slide change, then check new content
            collapseBodyImmediate();
        });
    });
});
