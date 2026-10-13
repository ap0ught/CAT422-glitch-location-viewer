import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const roomLayers = require('../js/room-layers.js');
const roomId = 'GIFPD818SEI26JR';
const room = JSON.parse(fs.readFileSync('locations/' + roomId + '.json', 'utf8'));

test('scenery URLs are PNG only', () => {
    assert.equal(roomLayers.sceneryUrl('house_medium_01'), 'img/scenery/house_medium_01.png');
    for (const extension of ['png', 'jpg', 'jpeg', 'gif']) {
        assert.equal(roomLayers.sceneryUrl('house_medium_01.' + extension), 'img/scenery/house_medium_01.png');
    }
    assert.equal(roomLayers.sceneryUrl(' sign.SWF '), null);
    assert.equal(roomLayers.sceneryUrl(''), null);
    assert.equal(roomLayers.sceneryUrl(null), null);
});

test('Baram Sum layers are listed back to front with a gameplay layer', () => {
    const manifest = roomLayers.layerManifest(room, roomId);
    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.roomId, roomId);
    const zs = manifest.layers.map(layer => layer.z);
    assert.deepEqual(zs, [...zs].sort((a, b) => a - b));
    assert.equal(manifest.layers.length, Object.keys(room.dynamic.layers).length);
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
    assert.deepEqual(manifest.dropped, []);
});

test('dropped pieces remain in the room and their layer response', () => {
    const dropped = [
        roomLayers.droppedPiece('middleground', 'sign.swf', 'flash'),
        roomLayers.droppedPiece('middleground', 'missing_tree', 'missing-png'),
        roomLayers.droppedPiece('middleground', 'tree', 'unpainted-layer')
    ];
    const manifest = roomLayers.layerManifest(room, roomId, dropped);
    assert.equal(dropped[0].url, null);
    assert.equal(dropped[1].url, 'img/scenery/missing_tree.png');
    assert.deepEqual(manifest.dropped, dropped);
    assert.deepEqual(manifest.layers.find(layer => layer.gameplay).dropped, dropped);
    assert.equal(manifest.layers.length, Object.keys(room.dynamic.layers).length);
});

test('middleground art is placed from the room origin', () => {
    assert.deepEqual(roomLayers.worldOrigin(room.dynamic), {x: 3000, y: 1000});
    assert.deepEqual(roomLayers.worldOrigin({l: -750, t: -1350, r: 750, b: 1350}), {x: 750, y: 1350});
});

test('independent layer shifts match the original parallax formula', () => {
    assert.equal(roomLayers.layerTranslate(5100, 0, 1000), 0);
    assert.equal(roomLayers.layerTranslate(5100, 1, 1000), -4100);
    assert.equal(roomLayers.layerTranslate(5100, 0.5, 1000), -2050);
    assert.equal(roomLayers.layerTranslate(2001, 0.5, 1000), -501);
    assert.equal(roomLayers.cameraPercent(0, 4000, 1000), 0);
    assert.equal(roomLayers.cameraPercent(2000, 4000, 1000), 0.5);
    assert.equal(roomLayers.cameraPercent(99999, 4000, 1000), 1);
    assert.equal(roomLayers.cameraPercent(10, 1000, 1000), 0);
    assert.equal(roomLayers.cameraPercent(10, 500, 1000), 0);
});

test('platform locations match the existing Baram Sum export', () => {
    const platforms = roomLayers.platformLocations(room, roomId);
    const exported = JSON.parse(fs.readFileSync('data/platforms/' + roomId + '.json', 'utf8'));
    assert.equal(platforms.lines.length, 66);
    assert.deepEqual(platforms, exported);
});

function viewer(search = '?render=1') {
    const elements = new Map();
    const requests = [];
    function $(selector) {
        if (!elements.has(selector)) {
            const element = {
                handlers: {},
                css() { return this; },
                text(value) { this.content = value; return this; },
                empty() { this.emptied = true; return this; },
                fadeOut() { return this; },
                hide() { this.hidden = true; return this; },
                stop() { return this; },
                fadeTo() { return this; },
                remove() { return this; },
                append() { return this; },
                bind(event, handler) { this.handlers[event] = handler; return this; },
                attr(name, value) {
                    if (name === 'src') {
                        requests.push(value);
                        this.handlers.error();
                    }
                    return this;
                }
            };
            elements.set(selector, element);
        }
        return elements.get(selector);
    }
    $.getScript = url => requests.push(url);
    const context = vm.createContext({
        $, room: structuredClone(room), roomLayers, window: {},
        document: {getElementById() { return null; }},
        location: {search}, console: {log() {}},
        player: {otherUsers: {}, loaded: true}
    });
    vm.runInContext(fs.readFileSync('js/control.js', 'utf8'), context);
    Object.assign(context.control, {
        currentRoomId: roomId, stageWidth: 6000, stageHeight: 1000,
        loadingRoom: false, loadtime: {start: new Date()}
    });
    return {context, elements, requests};
}

test('render readiness publishes layers and omissions, with platforms only when requested', () => {
    for (const search of ['?render=1&w=2000', '?render=1&platforms=1']) {
        const {context, elements} = viewer(search);
        const {control, window} = context;
        control.noteSkipped('middleground', 'missing_tree', 'missing-png');
        let ready = false;
        Object.defineProperty(window, '__RENDER_READY__', {
            set(value) {
                assert.equal(window.__RENDER_LAYERS__.roomId, roomId);
                assert.equal(window.__RENDER_LAYERS__.dropped.length, 1);
                ready = value;
            }
        });
        control.finishLevel();
        assert.equal(ready, true);
        assert.ok([...elements].some(([selector, element]) =>
            selector.split(', ').includes('.worldMap') && element.hidden));
        assert.equal(window.__RENDER_SKIPPED__, window.__RENDER_LAYERS__.dropped);
        assert.equal(window.__RENDER_W, search.includes('w=2000') ? 2000 : 6000);
        assert.equal('__RENDER_PLATFORMS__' in window, search.includes('platforms=1'));
        if (window.__RENDER_PLATFORMS__) assert.equal(window.__RENDER_PLATFORMS__.lines.length, 66);
    }
});

test('missing PNG, Flash and unpainted pieces do not stop the image queue', () => {
    const {context, requests} = viewer();
    const {control, window} = context;
    context.room.dynamic.layers = {
        middleground: {z: 0, w: 100, h: 100, items: [
            {filename: 'sign.swf', w: 1, h: 1},
            {filename: 'missing_tree', w: 1, h: 1}
        ]},
        invalid: {z: -1, decos: [{filename: 'tree'}]}
    };
    control.layerQueue = ['middleground'];
    control.maxImageCount = control.currentImageCount = 2;
    control.noteUnpaintedLayers();
    control.loadImages();
    assert.equal(window.__RENDER_READY__, true);
    assert.equal(control.currentImageCount, 0);
    assert.deepEqual(requests, ['img/scenery/missing_tree.png']);
    assert.deepEqual(Array.from(window.__RENDER_SKIPPED__, drop => drop.reason),
        ['unpainted-layer', 'missing-png', 'flash']);
    assert.equal(window.__RENDER_LAYERS__.layers.length, 2);
});

test('loading another room clears stale capture state and layer IDs', () => {
    const {context, requests} = viewer('?render=1&platforms=1');
    const {control, window} = context;
    control.finishLevel();
    control.layersId = ['old_layer'];
    control.loadRoom('LGIFPD818SEI26JR');
    assert.equal(window.__RENDER_READY__, false);
    for (const key of ['__RENDER_LAYERS__', '__RENDER_SKIPPED__', '__RENDER_PLATFORMS__']) {
        assert.equal(key in window, false);
    }
    assert.equal(control.layersId.length, 0);
    assert.equal(requests.length, 1);
    assert.equal(context.$('#layerControls').emptied, true);
});

test('layer links toggle only their canvas, support keyboard use, and refresh for a new room', () => {
    const {context} = viewer('');
    function node() {
        return {
            style: {}, attributes: {}, children: [], events: {},
            set textContent(value) { this.text = value; this.children = []; },
            get textContent() { return this.text; },
            setAttribute(name, value) { this.attributes[name] = value; },
            appendChild(child) { this.children.push(child); },
            addEventListener(name, handler) { this.events[name] = handler; },
            click() { this.events.click({preventDefault() {}}); }
        };
    }
    const list = node();
    const background = node();
    const gameplay = node();
    const nodes = new Map([
        ['layerControls', list], ['background_canvas', background], ['middleground_canvas', gameplay]
    ]);
    context.document = {
        getElementById(id) { return nodes.get(id); },
        createElement() { return node(); }
    };
    const manifest = {layers: [
        {canvasId: 'background_canvas', name: '<background>'},
        {canvasId: 'middleground_canvas', name: 'middleground'},
        {canvasId: 'unpainted_canvas', name: 'unpainted'}
    ]};
    context.control.updateLayerControls(manifest);
    assert.equal(list.children.length, 2, 'unpainted layers have no visibility link');
    const link = list.children[0].children[0];
    assert.equal(link.textContent, 'Disable <background>');
    assert.equal(link.attributes['aria-pressed'], 'true');
    assert.equal(link.attributes['aria-controls'], 'background_canvas');
    link.click();
    assert.equal(background.style.visibility, 'hidden');
    assert.equal(gameplay.style.visibility, undefined);
    assert.equal(link.textContent, 'Enable <background>');
    assert.equal(link.attributes['aria-pressed'], 'false');
    link.events.keydown({key: ' ', preventDefault() {}});
    assert.equal(background.style.visibility, 'visible');
    assert.equal(link.attributes['aria-pressed'], 'true');
    context.control.updateLayerControls({layers: [manifest.layers[1]]});
    assert.equal(list.children.length, 1, 'old layer links are removed');
    assert.equal(list.children[0].children[0].textContent, 'Disable middleground');
});

test('dropped scenery names are displayed as text, not interpreted as HTML', () => {
    const {context, elements} = viewer();
    context.control.noteSkipped('middleground', '<img onerror=alert(1)>', 'missing-png');
    context.control.finishLevel();
    assert.match(elements.get('.debug').content, /<img onerror=alert\(1\)>/);
});
