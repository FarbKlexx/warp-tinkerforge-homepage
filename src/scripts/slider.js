document.addEventListener("DOMContentLoaded", () => {
    const sliderNav = document.querySelector('nav[aria-label="Slider tabs"]');
    if (!sliderNav) return;

    const tabs = Array.from(sliderNav.querySelectorAll('button'));
    
    // Elements to update
    const sliderImage = document.getElementById('slider-image');
    const sliderImageBg = document.getElementById('slider-image-bg');
    const sliderBadge = document.getElementById('slider-badge');
    const sliderHeadline = document.getElementById('slider-headline');
    const sliderBody = document.getElementById('slider-body');

    // Data corresponding to the tabs
    const tabData = [
        {
            badge: "NEU",
            headline: "Bereit für die nächste Generation des Ladens.",
            body: "Der WARP4 unterstützt den Kommunikationsstandard ISO 15118 und ist damit hardwareseitig für bidirektionales Laden vorbereitet, um Ihr Fahrzeug künftig als Energiespeicher nutzen zu können. Zudem ermöglicht die erweiterte Kommunikation das direkte Auslesen des Fahrzeug-Ladestands (SoC), wodurch sich Ladevorgänge und das eigene Energiemanagement noch präziser steuern lassen.",
            image: "./assets/images/img-placeholder-1.png"
        },
        {
            badge: "",
            headline: "Laden ohne Stecken und Tippen.",
            body: "Mit Autocharge erkennt die Wallbox Ihr Fahrzeug automatisch und startet den Ladevorgang sofort. Kein RFID-Chip, keine App – einfach einstecken und laden.",
            image: "./assets/images/img-placeholder-2.png"
        },
        {
            badge: "",
            headline: "Zeitloses Design für jede Umgebung.",
            body: "Das moderne Gehäusedesign des WARP4 Charger fügt sich harmonisch in jede Umgebung ein. Pulverbeschichtetes Metall und ein klares, minimalistisches Layout machen es zur ästhetischen Ergänzung Ihrer Garage oder Einfahrt.",
            image: "./assets/images/img-placeholder-3.png"
        }
    ];

    if (!sliderImage || !sliderHeadline || !sliderBody) return;

    let transitionTimeout;

    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => {
            // Update tabs state
            tabs.forEach((t, i) => {
                if (i === index) {
                    t.setAttribute('aria-selected', 'true');
                    t.classList.add('bg-white/30');
                    t.classList.remove('hover:bg-white/10');
                } else {
                    t.setAttribute('aria-selected', 'false');
                    t.classList.remove('bg-white/30');
                    t.classList.add('hover:bg-white/10');
                }
            });

            // Update content dynamically to match React state behavior
            const data = tabData[index];
            
            // Image transition
            if (sliderImageBg) {
                clearTimeout(transitionTimeout);
                
                // Put the new image in the background
                sliderImageBg.src = data.image;
                
                // Fade out the foreground image to reveal the background
                sliderImage.style.transition = '';
                sliderImage.style.opacity = '0';
                
                transitionTimeout = setTimeout(() => {
                    // Update foreground silently
                    sliderImage.style.transition = 'none';
                    sliderImage.src = data.image;
                    sliderImage.alt = data.headline;
                    sliderImage.style.opacity = '1';
                    
                    // Force browser reflow
                    void sliderImage.offsetWidth;
                    
                    // Restore transition class behavior
                    sliderImage.style.transition = '';
                }, 300);
            }

            // Text update
            sliderHeadline.textContent = data.headline;
            sliderBody.textContent = data.body;

            // Handle optional badge
            if (sliderBadge) {
                if (data.badge) {
                    sliderBadge.textContent = data.badge;
                    sliderBadge.style.display = 'block';
                } else {
                    sliderBadge.style.display = 'none';
                }
            }
        });
    });
});
