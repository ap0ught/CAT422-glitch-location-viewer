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

The viewer can serve the same payload for any loaded room without writing a
file: add `platforms=1` to the page URL. It is omitted unless that flag is set.
The value is `window.__RENDER_PLATFORMS__`.

## Served layers
`?render=1#/ROOM` still frames the room for a full-stage capture. It also
publishes each source layer on `window.__RENDER_LAYERS__` (back to front) once
`window.__RENDER_READY__` is true. Paint for a layer is the canvas
`#<id>_canvas`, for example `#middleground_canvas`. Scroll a layer with the
manifest's formula, `Math.floor(percent * (viewport - layerSpan))`, where
percent is 0 at the near edge of the room and 1 at the far edge. The
middleground layer is the gameplay layer (`gameplay: true`).

Add `layers=middleground` or `layers=middleground,sky` to paint only those
layers. Any other layer is left out of the image queue: its scenery is not
requested and it gets no canvas. The manifest still lists it, with
`painted: false`, `canvasId: null`, and `omitReason: "not-requested"`. Its
decorations are not copied into `dropped`. An id in `layers` that the room
does not have is listed on `notFound`. Omit `layers` to paint every layer
that has a size.

Scenery is requested only as `img/scenery/<filename>.png`. Flash/SWF files are
not requested. A missing PNG, a Flash file, or a piece on a layer that cannot
be painted is still returned to the requester. The list is
`window.__RENDER_LAYERS__.dropped` (and each layer's own `dropped` array).
`window.__RENDER_SKIPPED__` is that same list. Each entry has `layerId`,
`filename`, `reason` (`missing-png`, `flash`, or `unpainted-layer`), and `url`
(the PNG that was requested, or null when no PNG is served). The room is still
served. The on-page missing-image list groups those entries by filename, so a
file used many times is one line with a count. The panel scrolls if the unique
list is still long.

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
