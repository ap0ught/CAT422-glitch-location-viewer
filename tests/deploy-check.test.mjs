// Deployment gate for the static site: Vercel and GitHub Pages serve this
// directory as-is with no build step, so anything that would 404 or fail to
// parse in the browser must be caught here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const locationsDir = 'locations';
const files = fs.readdirSync(locationsDir);
const roomFiles = files.filter(f => f.endsWith('.json') && !f.endsWith('.callback.json'));
const callbackFiles = files.filter(f => f.endsWith('.callback.json'));

test('every room .json file parses and has a layer tree', () => {
    const bad = [];
    for (const f of roomFiles) {
        try {
            const room = JSON.parse(fs.readFileSync(path.join(locationsDir, f), 'utf8'));
            if (!room.dynamic || typeof room.dynamic.layers !== 'object') bad.push(f);
        } catch (e) {
            bad.push(f + ' (' + e.message + ')');
        }
    }
    assert.ok(roomFiles.length > 0, 'no room files found in ' + locationsDir);
    assert.deepEqual(bad, [], 'Unusable room files: ' + bad.slice(0, 10).join(', '));
});

test('every .callback.json pairs with a .json, wraps its payload, and matches its room id', () => {
    const bad = [];
    for (const f of callbackFiles) {
        const roomId = f.replace('.callback.json', '');
        if (!roomFiles.includes(roomId + '.json')) {
            bad.push(f + ' has no matching .json');
            continue;
        }
        const text = fs.readFileSync(path.join(locationsDir, f), 'utf8');
        if (!/^getRoom\(/.test(text) || !text.trimEnd().endsWith(')')) {
            bad.push(f + ' is not a getRoom() wrapper');
            continue;
        }
        try {
            const payload = JSON.parse(text.slice('getRoom('.length).replace(/\)\s*$/, ''));
            if (payload.tsid !== roomId) bad.push(f + ' tsid mismatch (' + payload.tsid + ')');
        } catch (e) {
            bad.push(f + ' payload does not parse: ' + e.message);
        }
    }
    assert.deepEqual(bad, [], 'Bad callback files: ' + bad.slice(0, 10).join(', '));
});

test('index.html only references local assets that exist', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
        .map(m => m[1])
        .filter(u => !/^[a-z][a-z0-9+.-]*:/i.test(u)) // drop http:, https:, mailto: etc.
        .map(u => u.split('?')[0].split('#')[0])
        .filter(u => u.length > 0);
    const missing = refs.filter(u => !fs.existsSync(u));
    assert.deepEqual(missing, [], 'Missing local assets: ' + missing.join(', '));
});

test('the default room (no URL hash) exists', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    const m = html.match(/startRoom\s*=\s*['"]([A-Z0-9]+)/);
    assert.ok(m, 'could not find the default startRoom in index.html');
    const roomId = m[1];
    assert.ok(fs.existsSync(path.join(locationsDir, roomId + '.json')), roomId + '.json missing');
    assert.ok(fs.existsSync(path.join(locationsDir, roomId + '.callback.json')), roomId + '.callback.json missing');
});

test('the sidebar links to all eight Metroid world streets instead of retired chats', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    const sidebar = html.match(/<nav class="worldMap"[^>]*>([\s\S]*?)<\/nav>/);
    assert.ok(sidebar, 'world map sidebar missing');
    assert.match(sidebar[1], /href="https:\/\/github.com\/ap0ught\/puzzle-workshop\/issues\/14"/);
    const roomIds = [...sidebar[1].matchAll(/href="#\/([A-Z0-9]+)"/g)].map(m => m[1]);
    assert.deepEqual(roomIds, [
        'GIFPD818SEI26JR', 'GIF44E96U4I2OQK', 'GA9QR2STO832N8E', 'GDOC74759ST2IG1',
        'GHF70EIUS0D3RDM', 'GA524M0OMOE2OGT', 'GM413SQ6LRN58', 'GM410QQ0CHARO'
    ]);
    for (const roomId of roomIds) {
        assert.ok(fs.existsSync(path.join(locationsDir, roomId + '.callback.json')));
    }
    assert.doesNotMatch(html, /class="(?:globalChat|localChat|nameChange|instructions)"/);
});

test('scenery image gap (informational - viewer tolerates missing PNGs)', () => {
    const missing = new Set();
    for (const f of roomFiles) {
        const room = JSON.parse(fs.readFileSync(path.join(locationsDir, f), 'utf8'));
        for (const layer of Object.values(room.dynamic.layers)) {
            for (const deco of (layer.decos || [])) {
                if (deco.filename && !fs.existsSync(path.join('img/scenery', deco.filename + '.png'))) {
                    missing.add(deco.filename);
                }
            }
        }
    }
    // Not asserted: this is a known, pre-existing data gap that the viewer
    // renders gracefully (missing names show up in the on-page debug box).
    console.log('Scenery PNGs referenced but absent: ' + missing.size);
    assert.ok(true);
});
