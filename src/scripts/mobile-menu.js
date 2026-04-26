(function () {
    const menuBtn = document.getElementById("mobile-menu-btn");
    const closeBtn = document.getElementById("mobile-menu-close");
    const overlay = document.getElementById("mobile-menu-overlay");
    const panel = document.getElementById("mobile-menu");

    function openMenu() {
        overlay.classList.remove("opacity-0", "invisible");
        overlay.classList.add("opacity-100");
        panel.classList.remove("translate-x-full");
        panel.classList.add("translate-x-0");
        menuBtn.setAttribute("aria-expanded", "true");
        document.body.style.overflow = "hidden";
    }

    function closeMenu() {
        overlay.classList.remove("opacity-100");
        overlay.classList.add("opacity-0");
        panel.classList.remove("translate-x-0");
        panel.classList.add("translate-x-full");
        menuBtn.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
        setTimeout(() => overlay.classList.add("invisible"), 300);
    }

    menuBtn.addEventListener("click", openMenu);
    closeBtn.addEventListener("click", closeMenu);
    overlay.addEventListener("click", closeMenu);

    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closeMenu();
    });

    document.querySelectorAll(".mobile-accordion-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            var content = document.getElementById(btn.dataset.target);
            var icon = btn.querySelector(".expand-icon");
            var isOpen = btn.getAttribute("aria-expanded") === "true";
            btn.setAttribute("aria-expanded", String(!isOpen));
            if (isOpen) {
                content.style.maxHeight = "0";
                icon.style.transform = "";
            } else {
                content.style.maxHeight = content.scrollHeight + "px";
                icon.style.transform = "rotate(180deg)";
            }
        });
    });
})();
