#!/usr/bin/env node
// Export geometry already preserved by convert-locations.coffee.
// Usage: node tools/export-platforms.mjs [room-id] [output-directory]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const roomLayers = require('../js/room-layers.js');

const roomId = (process.argv[2] || 'GIFPD818SEI26JR').replace(/^L/, 'G');
const outputDir = process.argv[3] || 'data/platforms';
const input = JSON.parse(fs.readFileSync(path.join('locations', roomId + '.json'), 'utf8'));
const out = roomLayers.platformLocations(input, roomId);
fs.mkdirSync(outputDir, {recursive: true});
const filename = path.join(outputDir, roomId + '.json');
fs.writeFileSync(filename, JSON.stringify(out, null, 2) + '\n');
console.log(filename + ': ' + out.lines.length + ' platform lines');
