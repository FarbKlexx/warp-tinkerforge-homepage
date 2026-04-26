/*
 * ==============================================================================
 * Copyright (c) 2026 Tinkerforge GmbH. All rights reserved.
 * * This source code was designed and developed by coupling media GmbH
 * on behalf of Tinkerforge GmbH.
 * ==============================================================================
 */

document.addEventListener("DOMContentLoaded", () => {
    const scrollContainer = document.getElementById("products-container");
    const btnLeft = document.getElementById("scroll-products-left");
    const btnRight = document.getElementById("scroll-products-right");
    const cards = document.querySelectorAll(".product-card");

    if (!scrollContainer) return;

    // Scroll buttons logic
    if (btnLeft && btnRight) {
        const getScrollAmount = () => {
            if (!cards.length) return 0;
            const cardWidth = cards[0].offsetWidth;
            const gap = parseFloat(getComputedStyle(scrollContainer).gap) || 0;
            return cardWidth + gap;
        };

        btnLeft.addEventListener("click", () => {
            scrollContainer.scrollBy({ left: -getScrollAmount(), behavior: "smooth" });
        });
        btnRight.addEventListener("click", () => {
            scrollContainer.scrollBy({ left: getScrollAmount(), behavior: "smooth" });
        });
    }

    // Active Card Glow Logic
    const updateActiveCard = () => {
        if (!cards.length) return;

        let minDiff = Infinity;
        let activeCard = null;

        const containerRect = scrollContainer.getBoundingClientRect();
        // Calculate the exact snap point (left edge of container + computed padding-left)
        const paddingLeft = parseFloat(getComputedStyle(scrollContainer).paddingLeft) || 0;
        const targetX = containerRect.left + paddingLeft;

        cards.forEach((card) => {
            const rect = card.getBoundingClientRect();
            // We want the card whose left edge is closest to our target snap point
            const diff = Math.abs(rect.left - targetX);

            if (diff < minDiff) {
                minDiff = diff;
                activeCard = card;
            }
        });

        cards.forEach((card) => card.classList.remove("is-active"));
        if (activeCard) {
            activeCard.classList.add("is-active");
        }
    };

    // Listen to scroll events to update active card dynamically
    scrollContainer.addEventListener("scroll", () => {
        window.requestAnimationFrame(updateActiveCard);
    });

    // Also update on resize as padding values might change via media queries
    window.addEventListener("resize", () => {
        window.requestAnimationFrame(updateActiveCard);
    });

    // Initial check
    // Delay slightly to ensure layout is fully computed
    setTimeout(updateActiveCard, 50);
});
