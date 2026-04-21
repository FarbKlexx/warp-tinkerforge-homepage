# warp-tinkerforge-homepage

- Styling Development läuft über `Tailwind CLI`
  - Überwacht `index.html` und schreibt Tailwind Styling in echtzeit in die `output.css`.
> [!IMPORTANT]  
> Das Projekt wird mit Tailwind v4 entwickelt. Die `input.css` ersetzt die alte `tailwind.config.js`.
- Befehlt zum starten des Tailwind Compilers in der `package.json`. Bei Styling-Änderungen `npm run dev` ausführen und dann Änderungen in den `HTML-Dateien` oder ggf. der `input.css` vornehmen. Der Compiler übersetzt diese dann in real-time in Natives CSS und schreibt das Ergebniss in die `output.css`.
- Dadurch muss kein unnötiges Styling geladen werden, sondern ausschließlich das was auch auf der Seite benutzt wird.
- Für das Deployen / die Live-Version ist Tailwind dann nicht mehr nötig; Das gesamte Styling ist in der `output.css` (Tailwind ist hier ausschließlich für das Development nötig).
- Fonts werden, wenn möglich, über die Google Font API (https://fonts.google.com/) geladen.
- Andere Fonts (Satoshi Variable) müssen im Ordner `assets/fonts` abgelegt werden damit sie geladen werden können
- Icons werden über die Google Material Design API (https://fonts.google.com/icons) geladen.
- Individuelle Icons werden aufgrund von Ladezeitoptimierung aus einem SVG-Spritesheet geladen (`assets/images/icons.svg`).