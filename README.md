# 🧭 Fahrradtour Planer

Eine kleine Progressive Web App (PWA), die zufällige Fahrradtouren plant. Du wählst eine Himmelsrichtung und die gewünschte Dauer – die App berechnet ein Ziel und öffnet die Route in Google Maps.

## Features

- 🎲 Zufällige oder gezielte Himmelsrichtung
- ⏱️ Tourdauer von 1 bis 10 Stunden
- 📍 Automatische Distanzberechnung anhand der Fahrzeit
- ✅ Online-Prüfung der berechneten Fahrzeit gegen eine Fahrrad-Routing-Schätzung
- 🗺️ Direktes Öffnen der Route in Google Maps (Fahrradmodus)
- 📱 Installierbar als PWA mit Offline-Unterstützung
- 🕒 Verlauf der letzten 10 Touren (lokal gespeichert)

## Lokal ausführen

Da die App einen Service Worker nutzt, sollte sie über einen Webserver (nicht per Doppelklick auf die Datei) geöffnet werden:

```bash
# Mit Python
python3 -m http.server 8000

# Oder mit Node
npx serve
```

Dann im Browser `http://localhost:8000` öffnen.

## Veröffentlichen mit GitHub Pages

1. Repository auf GitHub anlegen und diesen Ordner pushen.
2. In den Repository-Einstellungen unter **Settings → Pages** als Quelle den Branch `main` und den Ordner `/ (root)` auswählen.
3. Nach kurzer Zeit ist die App unter `https://<dein-benutzername>.github.io/<repo-name>/` erreichbar.

> Hinweis: Standort und Service Worker funktionieren nur über HTTPS (oder localhost). GitHub Pages liefert automatisch HTTPS.

## Dateien

- `index.html` – Aufbau und Styling
- `app.js` – Anwendungslogik
- `sw.js` – Service Worker für Offline-Nutzung
- `manifest.json` – PWA-Manifest
- `icon.svg` – App-Icon

## Lizenz

MIT – siehe [LICENSE](LICENSE).
