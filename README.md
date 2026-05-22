# Fahrradtour Planer

Diese App kann direkt über **GitHub Pages** bereitgestellt werden.

## GitHub Pages aktivieren

1. Öffne **Settings → Pages** im Repository `Utzzy/bike-tour-app`
2. Wähle bei **Build and deployment**:
   - **Source:** `Deploy from a branch`
   - **Branch:** `main`
   - **Folder:** `/bike-tour-app`
3. Speichern
4. Danach ist die App über GitHub Pages erreichbar

## Struktur

Die eigentliche Web-App liegt im Ordner `bike-tour-app/` und ist bereits für relativen Betrieb vorbereitet:

- `index.html`
- `app.js`
- `manifest.json`
- `sw.js`
- `icon.svg`

Dadurch funktioniert sie auch unter einem Unterpfad wie GitHub Pages.
