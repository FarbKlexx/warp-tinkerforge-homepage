/*
 * ==============================================================================
 * Copyright (c) 2026 Tinkerforge GmbH. All rights reserved.
 * * This source code was designed and developed by coupling media GmbH
 * on behalf of Tinkerforge GmbH.
 * ==============================================================================
 */

// ─── Backend Placeholders ─────────────────────────────────────────────────────

async function sendContactForm({ name, email, message }) {
    // TODO: implement backend / api integration
    throw new Error("Backend not yet implemented");
}

async function sendNewsletterSignup({ email }) {
    // TODO: implement backend / api integration
    throw new Error("Backend not yet implemented");
}

// ─── Validation ──────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateForm(name, email, message) {
    const errors = {};
    if (!name.trim()) errors.name = true;
    if (!EMAIL_RE.test(email.trim())) errors.email = true;
    if (!message.trim()) errors.message = true;
    return errors;
}

// ─── UI Helpers ──────────────────────────────────────────────────────────────

function setFieldError(field, hasError) {
    const wrap = document.getElementById(`wrap-${field}`);
    const msg = document.getElementById(`error-${field}`);
    const defaultBorder = wrap.dataset.border;
    wrap.classList.toggle("border-red-500", hasError);
    wrap.classList.toggle(defaultBorder, !hasError);
    msg.classList.toggle("hidden", !hasError);
}

function clearFieldError(field) {
    setFieldError(field, false);
}

function setSubmitting(button, isSubmitting) {
    button.disabled = isSubmitting;
    button.textContent = isSubmitting ? "Wird gesendet…" : "Beratung anfragen";
}

function showSuccessBanner(form) {
    const banner = document.createElement("p");
    banner.className = "text-green-400 text-sm text-center";
    banner.textContent = "Vielen Dank! Ihre Anfrage wurde gesendet.";
    form.replaceWith(banner);
}

function showSubmitError(button) {
    const msg = button.nextElementSibling;
    if (msg?.id === "submit-error") return;
    const el = document.createElement("p");
    el.id = "submit-error";
    el.className = "text-red-400 text-xs text-center";
    el.textContent = "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.";
    button.insertAdjacentElement("afterend", el);
}

// ─── Init: Contact Form ───────────────────────────────────────────────────────

const form = document.getElementById("contact-form");
const button = document.getElementById("contact-submit");

if (form && button) {
    // Clear errors on user input
    ["name", "email", "message"].forEach((field) => {
        const el = document.getElementById(`footer-${field}`);
        el?.addEventListener("input", () => clearFieldError(field));
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = document.getElementById("footer-name").value;
        const email = document.getElementById("footer-email").value;
        const message = document.getElementById("footer-message").value;

        const errors = validateForm(name, email, message);

        ["name", "email", "message"].forEach((field) => {
            setFieldError(field, !!errors[field]);
        });

        if (Object.keys(errors).length > 0) return;

        setSubmitting(button, true);
        document.getElementById("submit-error")?.remove();

        try {
            await sendContactForm({ name, email, message });
            showSuccessBanner(form);
        } catch {
            setSubmitting(button, false);
            showSubmitError(button);
        }
    });
}

// ─── Init: Newsletter Form ────────────────────────────────────────────────────

const newsletterForm = document.getElementById("newsletter-form");
const newsletterButton = document.getElementById("newsletter-submit");

if (newsletterForm && newsletterButton) {
    const input = document.getElementById("newsletter-email");
    const wrap = document.getElementById("wrap-newsletter");
    const error = document.getElementById("error-newsletter");

    input.addEventListener("input", () => {
        wrap.classList.remove("border-red-500");
        wrap.classList.add(wrap.dataset.border);
        error.classList.add("hidden");
    });

    newsletterForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = input.value;
        const valid = EMAIL_RE.test(email.trim());

        wrap.classList.toggle("border-red-500", !valid);
        wrap.classList.toggle(wrap.dataset.border, valid);
        error.classList.toggle("hidden", valid);

        if (!valid) return;

        newsletterButton.disabled = true;
        document.getElementById("newsletter-submit-error")?.remove();

        try {
            await sendNewsletterSignup({ email });
            const banner = document.createElement("p");
            banner.className = "text-green-400 text-sm";
            banner.textContent = "Vielen Dank! Sie sind jetzt angemeldet.";
            newsletterForm.replaceWith(banner);
        } catch {
            newsletterButton.disabled = false;
            const el = document.createElement("p");
            el.id = "newsletter-submit-error";
            el.className = "text-red-400 text-xs pl-1";
            el.textContent = "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.";
            wrap.insertAdjacentElement("afterend", el);
        }
    });
}
