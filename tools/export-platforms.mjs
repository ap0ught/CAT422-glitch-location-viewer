#!/usr/bin/env node
// Export geometry already preserved by convert-locations.coffee.
// Usage: node tools/export-platforms.mjs [room-id] [output-directory]
import fs from 'node:fs';
import path from 'node:path';
const roomId = (process.argv[2] || 'GIFPD818SEI26JR').replace(/^L/, 'G');
const outputDir = process.argv[3] || 'data/platforms';
const input = JSON.parse(fs.readFileSync(path.join('locations', roomId + '.json'), 'utf8'));
const layers = Object.entries(input.dynamic.layers || {});
const lines = layers.flatMap(([layerId, layer]) => (layer.platformLines || []).map(line => ({
  id: line.id, layerId, start: line.endpoints?.find(p => p.name === 'start') || null,
  end: line.endpoints?.find(p => p.name === 'end') || null,
  itemPermission: line.platform_item_perm, playerPermission: line.platform_pc_perm
})));
const out = {schemaVersion: 1, roomId, label: input.label,
  coordinateSystem: 'Original Glitch world coordinates (x,y), not canvas pixels',
  bounds: {l: input.dynamic.l, r: input.dynamic.r, t: input.dynamic.t, b: input.dynamic.b},
  lines};
fs.mkdirSync(outputDir, {recursive: true});
const filename = path.join(outputDir, roomId + '.json');
fs.writeFileSync(filename, JSON.stringify(out, null, 2) + '\n');
console.log(filename + ': ' + lines.length + ' platform lines');
