/*
 * ==============================================================================
 * Copyright (c) 2026 Tinkerforge GmbH. All rights reserved.
 * * This source code was designed and developed by coupling media GmbH
 * on behalf of Tinkerforge GmbH.
 * ==============================================================================
 */

const list = document.querySelector('.news-card')?.parentElement;

if (list) {
    list.style.position = 'relative';

    list.querySelectorAll('.news-toggle').forEach((btn) => {
        btn.addEventListener('click', () => {
            const card = btn.closest('.news-card');
            if (card.classList.contains('news-expanded')) {
                collapse(card);
            } else {
                const alreadyExpanded = list.querySelector('.news-expanded');
                if (alreadyExpanded) collapse(alreadyExpanded);
                expand(card);
            }
        });
    });
}

function expand(card) {
    const containerHeight = list.offsetHeight;
    const cardTop = card.offsetTop;
    const cardHeight = card.offsetHeight;

    card.dataset.originalTop = cardTop;

    list.style.height = containerHeight + 'px';

    const placeholder = document.createElement('div');
    placeholder.className = 'news-placeholder';
    placeholder.style.height = cardHeight + 'px';
    placeholder.style.flexShrink = '0';
    card.before(placeholder);

    // Snap to exact current position before animating
    card.style.position = 'absolute';
    card.style.top = cardTop + 'px';
    card.style.left = '0';
    card.style.right = '0';
    card.style.height = cardHeight + 'px';
    card.style.zIndex = '10';

    card.querySelector('.news-excerpt').classList.remove('line-clamp-2');
    card.querySelector('.news-toggle').textContent = 'weniger anzeigen';
    card.classList.add('news-expanded');

    // Animate top → 0 and height → full container height
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            card.style.transition = 'top 0.4s cubic-bezier(0.4, 0, 0.2, 1), height 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
            card.style.top = '0';
            card.style.height = containerHeight + 'px';
            card.addEventListener('transitionend', () => {
                card.style.transition = '';
                card.style.overflowY = 'auto';
            }, { once: true });
        });
    });
}

function collapse(card) {
    const placeholder = list.querySelector('.news-placeholder');
    const originalHeight = placeholder ? parseInt(placeholder.style.height) : card.offsetHeight;
    const originalTop = parseFloat(card.dataset.originalTop ?? '0');

    card.style.overflowY = '';
    card.querySelector('.news-excerpt').classList.add('line-clamp-2');
    card.querySelector('.news-toggle').textContent = 'mehr anzeigen';

    card.style.transition = 'top 0.4s cubic-bezier(0.4, 0, 0.2, 1), height 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    card.style.top = originalTop + 'px';
    card.style.height = originalHeight + 'px';

    card.addEventListener('transitionend', () => {
        placeholder?.remove();
        card.style.cssText = '';
        delete card.dataset.originalTop;
        list.style.height = '';
        card.classList.remove('news-expanded');
    }, { once: true });
}
