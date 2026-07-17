# Multicam Previz Engine

A browser-based tool for planning multi-camera lens choices in an
in-the-round venue before you order glass. Place cameras and a subject
on a floor plan, aim and zoom each camera, and read off the focal
length needed for the shot you want.

No build step, no backend, no dependencies — plain HTML/CSS/JS.

## Running it

Just open `index.html` in a browser. To publish it as a live link:

1. Push this folder to a public GitHub repo.
2. Repo → **Settings → Pages → Source → Deploy from a branch → `main` → `/root`**.
3. GitHub gives you a live URL: `https://<username>.github.io/<repo>/`.

Every push updates the live site automatically. No server, no API keys,
nothing else to configure.

## How to use it

- **Active camera** — pick any of the 12 cameras from Tony's plan.
- **Camera height / focal point height** — defaults are estimated;
  edit them once you have exact rigging numbers.
- **Aim preset / drag the green cross** — set what the camera is
  pointed at, either from the dropdown or by dragging the crosshair
  directly on the floor plan.
- **Focal length slider** — the whole point of the tool: zoom until
  the viewfinder shows the shot you want, then log it.
- **Actor** — add performers, set their real height/width/depth, and
  rotate their facing direction. The viewfinder shows face, profile,
  or back-of-head depending on the angle between camera and actor.
- **Shot note / Log shot** — capture what lens a camera needs for a
  given shot as you go.
- **Floor plan** — scroll to zoom, drag empty space to pan.

## Data basis — read before trusting the numbers

Camera positions and vignette angles were measured by rasterizing
Tony's PDF at high resolution and reading pixel coordinates against
the plan's own scale bars (95'2" room span, 29'6"/12'6" vignette
panels). That's a careful visual estimate, not a surveyed drawing —
treat every position as a strong starting point, and correct it
directly in `CAMS` in `app.js` once real rigging data is available.

Camera heights were not given on the plan and are placeholder
defaults (1.0–1.6m for floor cameras, 4.5m for the ladder cam) —
editable live in the tool via the height slider, or directly in the
`CAMS` object for permanent changes.

## Known limitations (this is a mockup)

- Actors render as simplified 2D sprites (shaded capsule body + shaded
  head, three-way face/profile/back logic) — not 3D meshes.
- Seating is stylised concentric rows, not measured seat-by-seat.
- No file/PDF export of the shot list yet.
- No automatic floor-plan ingestion yet — camera data is hand-entered
  in `CAMS`.

## Project structure

```
index.html   — page structure and controls
style.css    — layout and dark theme
app.js       — camera/venue data, projection math, rendering, interaction
```
