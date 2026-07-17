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

Camera and vignette positions come from Tony's PDF's actual **vector
data** — text label coordinates, embedded camera icon images, and the
vignette wall's own bezier path — extracted programmatically with
`pdfplumber`, not eyeballed off a rendered image. This is a real
improvement over an earlier pixel-guessing pass, but it's still a
one-time measurement of a drawing, not a surveyed venue. The venue
model:

- `R_AUDIENCE` (14.5m) — the seating boundary, from the 95'2" dimension line.
- `R_VIGNETTE` (16.4m) — the vignette back-wall radius, measured from
  the wall's own vector path.
- Vignette centre angles (155°, 122°, 90°, 57°, 24°) — measured from
  that same path, which spans 171°–8° (≈163°, about half the room).
- Each camera's angle/radius — measured from its icon image position
  relative to the circle centre (itself derived from the 95'2"
  dimension line's exact endpoints).

Camera heights were not given on the plan and are placeholder
defaults (1.0–1.6m for floor cameras, 4.5m for the ladder cam) —
editable live in the tool via the height slider, or directly in the
`CAMS` object for permanent changes.

## Venue model — stages, not an open floor

The five Vignettes are the performance positions (`STAGE_MARKS`, 2m
in front of each wall panel), not a decorative backdrop — the open
middle of the room is **audience seating** (three rectangular blocks,
~25 rows, defined in `SEAT_BLOCKS`/`SEAT_ROWS`). Actors default to
standing at a chosen Vignette mark (via the "Stand at" dropdown) and
remain freely draggable from there.

## Known limitations (this is a mockup)

- Actors render as simplified 2D sprites (shaded capsule body + shaded
  head, three-way face/profile/back logic) — not 3D meshes.
- Seating rows are evenly spaced straight-line rectangles; real venue
  seating often has curvature/rake this doesn't model.
- No file/PDF export of the shot list yet.
- No automatic floor-plan ingestion yet — camera data is hand-entered
  in `CAMS`, though now sourced from real vector measurements.

## Project structure

```
index.html   — page structure and controls
style.css    — layout and dark theme
app.js       — camera/venue data, projection math, rendering, interaction
```
