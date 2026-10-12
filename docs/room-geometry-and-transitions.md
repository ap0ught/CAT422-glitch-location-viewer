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
