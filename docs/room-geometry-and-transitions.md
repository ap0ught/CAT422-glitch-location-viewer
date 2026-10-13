# Room geometry, asset test, and transitions

## Asset regression test (Baram Sum)
Run `node --test tests/room-assets.test.mjs` from the repository root.
The test inventories all 756 decorations in `GIFPD818SEI26JR`, checks that each
referenced PNG exists under `img/scenery/`, and validates coordinates.
A failed asset assertion is **diagnostic**: the repository may intentionally lack
some original Flash-exported images. It does not prove that a successfully loaded
image is visible (it may be offscreen, obscured, or filtered).

## Export platform lines
Run `node tools/export-platforms.mjs GIFPD818SEI26JR` from the repository root.
Output: `data/platforms/GIFPD818SEI26JR.json`. The export includes the original
world-space endpoints, platform permissions, layer IDs and room bounds. The
Baram Sum room currently contains 66 platform segments. Coordinates are
**not** screen-space pixels. Use the room bounds and middleground transform
when connecting a physics engine; do not assume these are solid platforms
without interpreting the original permission flags.

The viewer serves the same payload for the loaded room on
`window.__RENDER_PLATFORMS__` only when `platforms=1` is present in the URL.
Platform lines are not painted into the scenery canvases.

## Served layers (PR #5 contract)
`?render=1#/ROOM` still frames the room for a full-stage capture. Before
`window.__RENDER_READY__` becomes true, it publishes a version 1 manifest on
`window.__RENDER_LAYERS__`. Its `layers` array lists all source layers back to
front, with `id`, `name`, `z`, `w`, `h`, `gameplay`, `canvasId`, `decoCount`, and
`dropped`. Paint is on `#<id>_canvas`, for example `#middleground_canvas`.
`middleground` is the gameplay layer. Other layers move independently according
to their width: `Math.floor(percent * (viewport - layerSpan))`, with percent 0
at the near edge and 1 at the far edge. Runtime motion uses the existing canvas
viewer; three.js and additional art packs are not needed.

### Layer URL arguments
- `?getLayers=1#/ROOM` publishes the full layer manifest on
  `window.__RENDER_LAYERS__` and sets `window.__RENDER_READY__` without creating
  canvases, processing decorations, or requesting scenery. This is a browser
  metadata response, not a JSON HTTP endpoint. The room data still loads.
- `?render=1&displayLayers=middleground#/ROOM` renders only middleground.
  Pass multiple exact layer IDs separated by commas, for example
  `displayLayers=middleground,T_1314039143686`. Only selected layers enter the
  canvas/scenery pipeline and appear in the returned manifest; excluded layers
  are not loaded or processed and are not reported as dropped.
- Without `displayLayers`, all layers render as before. An empty value or
  unknown IDs select no layers (no fallback to all). Duplicates are ignored.
  `getLayers=1` takes precedence over `displayLayers`, returning the full list.
  `platforms=1` remains optional and uses the returned layers.

For example, first open `?getLayers=1#/GIFPD818SEI26JR` to discover layer IDs,
then open `?render=1&displayLayers=middleground#/GIFPD818SEI26JR` to capture just
that canvas. URL selection also applies when navigating to another room.

In the right sidebar, **Enable/disable layers** opens visibility links for each
painted layer in the current room. Disabling a layer hides only its scenery
canvas, not the player or its parallax transform. The list refreshes on room
changes; newly loaded canvases start visible. These controls are hidden in
render mode and do not change raw canvas pixels or the capture manifest.

Scenery is requested only as `img/scenery/<name>.png`. Flash/SWF is not served;
JPEG/GIF filename extensions resolve to the PNG counterpart, not those formats.
Missing PNGs, Flash pieces, and pieces on unpainted layers do not fail the room.
They appear in the manifest's `dropped` array, each layer's `dropped`, and
`window.__RENDER_SKIPPED__`. Each entry has `layerId`, `filename`, `reason`
(`missing-png`, `flash`, `unpainted-layer`), and `url` (null for Flash).
A layer without usable dimensions has no painted canvas, but remains in the
manifest so consumers can report the omission.

Workshop capture should wait for `__RENDER_READY__`, save the manifest, and
capture each available canvas in `__RENDER_LAYERS__.layers` using its `canvasId`,
rather than flattening the page into one PNG. Keep the street even when
`dropped` is non-empty. Raw canvas PNGs preserve native resolution and
transparency; `w=` scales only the framed page. CSS layer filters and the stage
gradient are not baked into raw canvas pixels, so consumers needing the exact
composite must retain those effects separately or capture styled layers.
The workshop's `tools/render-rooms.mjs` is not in this repository; its capture
integration belongs to `ap0ught/puzzle-workshop#38`.

Run `node --test tests/room-layers.test.mjs` to check this contract.

## Signposts and doors
The viewer already converts signpost connections and shows them in the Exits
list. The change in this branch routes clicks through a transition helper that
accepts either L-prefixed or G-prefixed destination IDs and retains an optional
arrival coordinate for the destination room. The connection x/y values in the
source appear to describe the destination-side arrival location; these should
be validated visually before being treated as authoritative.

Doors are **not yet implemented**: the CoffeeScript converter currently
does not export them, and door semantics/assets need to be verified against
original XML. Do not fabricate doors from scenery decorations or treat every
signpost as a door.

## Limitations
This work exports geometry but does not yet apply platform collisions, gravity,
jumping or pathfinding to the player. Existing room JSON is not modified.
