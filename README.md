# warp-tinkerforge-homepage

- Styling Development läuft über `Tailwind CLI`
- - Überwacht `index.html` und schreibt Tailwind Styling in echtzeit in die `output.css`.
> [!IMPORTANT]  
> Das Projekt wird mit Tailwind v4 entwickelt. Die `input.css` ersetzt die alte `tailwind.config.js`.
- Befehlt zum starten des Compilers in der `package.json`. Bei Styling-Änderungen `npm run dev` ausführen und dann Änderungen in den `HTML-Dateien` oder ggf. der `input.css` vornehmen.
- Für das Deployen ist Tailwind nicht mehr nötig; Das gesamte Styling ist in der `output.css`.