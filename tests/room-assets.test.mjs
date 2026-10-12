import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const roomId = 'GIFPD818SEI26JR';
const room = JSON.parse(fs.readFileSync('locations/' + roomId + '.json', 'utf8'));
const decorations = Object.entries(room.dynamic.layers).flatMap(([layer, data]) =>
  (data.decos || []).map((deco, index) => ({layer, index, filename: deco.filename})));
test('Baram Sum inventory retains expected scenery and platforms', () => {
  assert.equal(decorations.length, 756);
  assert.equal(room.dynamic.layers.middleground.platformLines.length, 66);
});
test('every Baram Sum decoration has a matching PNG asset', () => {
  const missing = decorations.filter(d => !d.filename || !fs.existsSync(path.join('img/scenery', d.filename + '.png')));
  assert.deepEqual(missing, [], 'Missing PNG references: ' + JSON.stringify(missing.slice(0, 30)));
});
test('all scenery references have usable coordinates', () => {
  const invalid = Object.entries(room.dynamic.layers).flatMap(([layer, data]) =>
    (data.decos || []).filter(d => !['x','y','w','h'].every(k => Number.isFinite(d[k]))).map(d => ({layer, filename: d.filename})));
  assert.deepEqual(invalid, []);
});
