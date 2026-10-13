import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const roomLayers = require('../js/room-layers.js');

const roomId = 'GIFPD818SEI26JR';
const room = JSON.parse(fs.readFileSync('locations/' + roomId + '.json', 'utf8'));

test('scenery URLs are PNG only', () => {
    assert.equal(roomLayers.sceneryUrl('house_medium_01'), 'img/scenery/house_medium_01.png');
    assert.equal(roomLayers.sceneryUrl('house_medium_01.png'), 'img/scenery/house_medium_01.png');
    assert.equal(roomLayers.sceneryUrl('sign.swf'), null);
    assert.equal(roomLayers.sceneryUrl(''), null);
    assert.equal(roomLayers.sceneryUrl(null), null);
});

test('Baram Sum layers are listed back to front with a gameplay layer', () => {
    const manifest = roomLayers.layerManifest(room, roomId);
    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.roomId, roomId);
    assert.equal(manifest.label, 'Baram Sum');
    const zs = manifest.layers.map(layer => layer.z);
    assert.deepEqual(zs, [...zs].sort((a, b) => a - b));
    const gameplay = manifest.layers.filter(layer => layer.gameplay);
    assert.equal(gameplay.length, 1);
    assert.equal(gameplay[0].id, 'middleground');
    assert.equal(gameplay[0].canvasId, 'middleground_canvas');
    assert.equal(gameplay[0].decoCount, 171);
    const stripped = structuredClone(room);
    const mg = stripped.dynamic.layers.middleground;
    mg.decoCount = mg.decos.length;
    delete mg.decos;
    assert.equal(roomLayers.layerManifest(stripped, roomId).layers.find(layer => layer.gameplay).decoCount, 171);
    assert.ok(manifest.layers.length > 1);
    assert.match(manifest.parallax.translate, /viewport - layerSpan/);
    assert.deepEqual(manifest.dropped, []);
    assert.ok(manifest.layers.every(layer => Array.isArray(layer.dropped) && layer.dropped.length === 0));
});

test('dropped pieces are part of the layer response', () => {
    const drop = roomLayers.droppedPiece('middleground', 'sign.swf', 'flash');
    assert.equal(drop.url, null);
    assert.equal(drop.reason, 'flash');
    const missing = roomLayers.droppedPiece('bg', 'missing_tree', 'missing-png');
    assert.equal(missing.url, 'img/scenery/missing_tree.png');
    const manifest = roomLayers.layerManifest(room, roomId, [drop, missing]);
    assert.deepEqual(manifest.dropped, [drop, missing]);
    assert.deepEqual(manifest.layers.find(layer => layer.id === 'middleground').dropped, [drop]);
    assert.deepEqual(manifest.layers.find(layer => layer.id === 'bg'), undefined);
});

test('repeated missing scenery collapses to one on-page line', () => {
    const piece = roomLayers.droppedPiece('sky', 'k02_sky_2000x500', 'missing-png');
    const many = Array.from({length: 454}, () => ({...piece, layerId: 'sky'}));
    many.push(roomLayers.droppedPiece('middleground', 'sign.swf', 'flash'));
    const summary = roomLayers.summarizeDropped(many);
    assert.equal(summary.length, 2);
    assert.equal(summary[0].filename, 'k02_sky_2000x500');
    assert.equal(summary[0].count, 454);
    assert.equal(summary[0].url, 'img/scenery/k02_sky_2000x500.png');
    assert.equal(summary[1].count, 1);
    assert.equal(summary[1].url, null);
    assert.equal(many.length, 455);
});

test('middleground art is placed from the room origin', () => {
    assert.deepEqual(roomLayers.worldOrigin(room.dynamic), {x: 3000, y: 1000});
    assert.deepEqual(roomLayers.worldOrigin({l: -500, t: -700, r: 500, b: 0}), {x: 500, y: 700});
    assert.deepEqual(roomLayers.worldOrigin({l: -750, t: -1350, r: 750, b: 1350}), {x: 750, y: 1350});
});

test('layer shift matches the original parallax formula', () => {
    const viewport = 1000;
    assert.equal(roomLayers.layerTranslate(5100, 0, viewport), 0);
    assert.equal(roomLayers.layerTranslate(5100, 1, viewport), Math.floor(1 * (viewport - 5100)));
    assert.equal(roomLayers.layerTranslate(5100, 0.5, viewport), Math.floor(0.5 * (viewport - 5100)));
    assert.equal(roomLayers.layerTranslate('6000', 1, viewport), -5000);
    assert.equal(roomLayers.cameraPercent(0, 4000, viewport), 0);
    assert.equal(roomLayers.cameraPercent(2000, 4000, viewport), 0.5);
    assert.equal(roomLayers.cameraPercent(99999, 4000, viewport), 1);
    assert.equal(roomLayers.cameraPercent(10, viewport, viewport), 0);
});

test('platform locations stay optional and match the Baram Sum export', () => {
    const platforms = roomLayers.platformLocations(room, roomId);
    const exported = JSON.parse(fs.readFileSync('data/platforms/' + roomId + '.json', 'utf8'));
    assert.equal(platforms.lines.length, 66);
    assert.deepEqual(platforms, exported);
    assert.equal(platforms.lines.every(line => line.layerId === 'middleground'), true);
});
