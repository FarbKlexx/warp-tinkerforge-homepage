# WARP-Charger Homepage

Ein responsives, performantes und leichtgewichtiges Frontend-Projekt für die WARP-Charger Homepage. Der Fokus liegt auf minimalen Ladezeiten und besten SEO-Praktiken durch den Einsatz statischer Webtechnologien.

---

## Tech Stack & Architektur

- **HTML5:** Semantischer Aufbau und sauberes Meta-Tagging.
- **Tailwind CSS (v4):** Utility-first CSS-Framework für das Styling.
- **Vanilla JavaScript:** Für interaktive UI-Komponenten (ohne Overhead von großen Frameworks).
- **Prettier:** Automatisierte Code-Formatierung zur Einhaltung von Coding-Standards.

> [!IMPORTANT]  
> **Hinweis zu Tailwind v4:** Dieses Projekt nutzt bereits Tailwind CSS Version 4. Im Gegensatz zu älteren Versionen gibt es hier keine `tailwind.config.js` mehr. Die gesamte Konfiguration und Definition der Design-Tokens findet direkt in der `input.css` statt.

---

## Lokales Setup & Entwicklung

Das Projekt nutzt die Tailwind CLI, um Änderungen in Echtzeit zu kompilieren. Es wird ausschließlich das CSS generiert, das auch tatsächlich in den HTML-Dateien verwendet wird.

### Voraussetzungen
- Node.js (für das Ausführen der npm-Skripte)

### Installation & Start
1. Repository klonen und in den Projektordner wechseln.
2. Abhängigkeiten installieren:
   ```bash
   npm install
   ```
3. Den Development-Server (Tailwind Compiler im Watch-Modus) starten:
   ```bash
   npm run dev
   ```

Der Compiler überwacht nun die `index.html` (und alle weiteren konfigurierten HTML-Dateien) sowie die `input.css`. Änderungen werden in Echtzeit als natives CSS in die `output.css` geschrieben.

> [!IMPORTANT]  
> **Hinweis für das Deployment**: Tailwind wird für den Live-Betrieb nicht mehr benötigt. Das gesamte finale Styling befindet sich fertig kompiliert und minifiziert in der `output.css`. Dementsprechen ist auch keine Node.js installation auf dem Live-Server nötig.

---

## Styling & Asset Management

Um die Performance zu maximieren, wurden klare Regeln für das Asset-Management definiert:

### CSS-Richtlinien
- **Inline vs. Global:** Das Styling erfolgt primär über Utility-Klassen direkt im HTML. 
- **Wiederverwendbarkeit:** Stark wiederverwendbare Klassen oder komplexe Komponenten-Styles wurden mithilfe von Tailwind-Direktiven in die `input.css` ausgelagert, um den HTML-Code sauber zu halten.

### Fonts & Icons
- **Web-Fonts:** Standard-Schriftarten werden über die Google Fonts API geladen.
- **Lokale Fonts:** Spezifische Schriften wie *Satoshi Variable* liegen lokal im Verzeichnis `assets/fonts/`.
- **Icons:** Standard-Icons stammen aus der Google Material Design API.
- **Custom Icons:** Aus Gründen der Ladezeitoptimierung werden individuelle Icons aus einem SVG-Spritesheet (`assets/images/icons.svg`) geladen, anstatt viele einzelne Bilddateien einzubinden.

### Responsive Design
Das Layout wurde Mobile-First entwickelt und gezielt für folgende Standard-Seitenverhältnisse optimiert:
- **Mobile (`sm`):** iPhone 17 Pro (402x874)
- **Tablet (`md`):** iPad Pro 11-inch (834x1210)
- **Desktop (`lg`):** MacBook Pro (1440x900)

> [!NOTE]  
> Exotische Seitenverhältnisse, wie z.B. das quadratische Format eines Samsung Galaxy Z Fold, könnten vereinzelt zu Layout-Sprüngen führen. Der Fokus liegt bewusst auf gängigen Industrie-Standardsätzen.

---

## Performance & SEO

Hohe Performance und Suchmaschinenoptimierung sind Kernbestandteile dieses Projekts.

**Aktuelle Optimierungen:**
- Semantische Metadaten im `<head>`.
- Native `loading="lazy"` Attribute für Bilder.
- Minifizierte `output.css` im Build-Prozess.
- Ausschließlich weboptimierte Bildformate wie `.svg` und `.webp`.

### Google Lighthouse Scores (Baseline)
Die aktuellen Scores spiegeln die ungebundene lokale Entwicklungsumgebung wider (Werte können variieren). 
*(Stand: 26.04.2026)*

| Metrik | Desktop | Mobile |
| :--- | :---: | :---: |
| **Performance** | 96 | 73* |
| **Accessibility** | 100 | 100 |
| **Best Practices** | 100 | 100 |
| **SEO** | 100 | 100 |

***\*** Warum ist der Mobile-Performance-Score noch nicht bei 100?**
1. **Kein Caching:** Das Projekt läuft derzeit lokal/ohne optimierten Webserver. Sobald es live ist, wird Server-Caching die Ladezeiten drastisch verbessern.
2. **Bildoptimierung:** Für die mobile Ansicht könnten noch Responsive Images implementiert werden. Dies ist aber erst möglichen wenn die Finalen Bilder zur Verfügung stehen.