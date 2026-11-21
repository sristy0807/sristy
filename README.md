# sristy0807.github.io

Portfolio and playable games. Live at **https://sristy0807.github.io/sristy/**
Dashboard: **https://sristy0807.github.io/sristy/admin.html**

## How updates flow

```
game repo (cardSchool, dhakametaverse)      ← you push here first
   │  push to main → "Update website" workflow pings this repo (needs SITE_TOKEN secret)
   ▼
this repo: "Sync games" workflow            ← also runs every 15 min, on demand, or when sync-games.json changes
   │  copies each game's files into games/<folder>/ and commits if anything changed
   ▼
GitHub Pages rebuilds the site (~1 min)
```

- **Games that sync:** `sync-games.json` (or the dashboard's *Sync and publish* tab).
- **Site text:** `content.json` (dashboard *Profile* and *Work* tabs).
- **Game cards:** `games.json` (dashboard *Games* tab).
- **Instant updates:** add a repo secret `SITE_TOKEN` to each game repo (Settings → Secrets and variables → Actions). Use the same fine-grained token as the dashboard. Without it, changes still arrive within 15 minutes.

## Add a game

1. Put the web build in its own folder under `games/`, e.g. `games/penalty-shoot/` (it must contain an `index.html`).
2. Add an entry to `games.json`:
   - under `featured` for a big card, or
   - under `archive` (fill in `"play": "games/penalty-shoot/"`) for a row in the list.
3. Optional: add a cover image (e.g. `games/penalty-shoot/cover.jpg`, 16:10) and set `"thumbnail"`. Without one, a cover is generated.
4. Commit and push. GitHub Pages updates in about a minute.

```json
{
  "title": "Penalty Shoot",
  "year": 2022,
  "engine": "Unity",
  "description": "One line about the game.",
  "tags": ["Sports", "Casual"],
  "controls": "Swipe or drag to shoot.",
  "play": "games/penalty-shoot/",
  "source": "https://github.com/sristy0807/PenaltyShoot",
  "thumbnail": "games/penalty-shoot/cover.jpg"
}
```

`play` can also be a full URL (e.g. a game hosted in its own repo's GitHub Pages or on itch.io); it then opens directly instead of in the player page.

## Unity WebGL builds on GitHub Pages

GitHub Pages can't send the `Content-Encoding` header Unity's compressed builds need, so a default Brotli build shows a blank screen or a decompression error. Before building:

- **Player Settings > Publishing Settings > Compression Format: Disabled** (simplest), **or**
- keep Gzip and tick **Decompression Fallback** (smaller download, slightly slower start).

Also:
- Use the **Minimal** or **Default** WebGL template; the player page embeds it in an iframe and handles full screen.
- GitHub rejects single files over **100 MB** and repos should stay under ~1 GB. For a big game, give it its own repo with Pages enabled and put that URL in `play`.

## Run locally

```
python3 -m http.server 8000
```
then open http://localhost:8000 (opening `index.html` as a file won't load `games.json`).

## Files

| Path | What it is |
|---|---|
| `index.html` | The portfolio page. Edit bio, work history and contact links here. |
| `games.json` | The list of games. |
| `play.html` | Full-window player that loads a game from `games/`. |
| `assets/scan.js` | The hero WebGL shader (simulated ultrasound with window/level drag). |
| `assets/main.js` | Renders `games.json`. |
| `assets/style.css` | Styles. |
| `games/` | Game builds, one folder each. |
