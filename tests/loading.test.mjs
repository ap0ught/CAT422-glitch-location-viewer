import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const controlSource = fs.readFileSync(new URL('../js/control.js', import.meta.url), 'utf8');

function methodBody(name) {
    const start = controlSource.indexOf(name + ': function');
    assert.notEqual(start, -1, name + ' method not found');
    const end = controlSource.indexOf('\n    },', start);
    assert.notEqual(end, -1, name + ' method end not found');
    return controlSource.slice(start, end);
}

test('the stage remains hidden while room scenery is being rendered', () => {
    const prepStage = methodBody('prepStage');
    const hideStage = prepStage.indexOf("$('.stage').css('opacity', 0);");
    const startRendering = prepStage.indexOf('this.prepLayers();');

    assert.notEqual(hideStage, -1);
    assert.ok(startRendering > hideStage, 'stage should be hidden before rendering starts');
    assert.ok(!prepStage.includes("$('.stage').fadeTo(666, 1);"));
});

test('the completed stage is revealed after rendering, without delaying render captures', () => {
    const finishLevel = methodBody('finishLevel');

    assert.ok(finishLevel.includes("if (!renderMode) {\n            $('.stage').fadeTo(666, 1);"));
    assert.ok(finishLevel.includes("'opacity': 1"));
    assert.ok(finishLevel.indexOf("'opacity': 1") < finishLevel.indexOf('window.__RENDER_READY__ = true;'));
});
