const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function eventTarget() {
    const listeners = new Map();
    return {
        style: {},
        listeners,
        addEventListener(name, handler) {
            if (!listeners.has(name)) listeners.set(name, new Set());
            listeners.get(name).add(handler);
        },
        removeEventListener(name, handler) {
            listeners.get(name)?.delete(handler);
        },
        querySelector() { return { style: {} }; },
    };
}

function listenerCount(target, name) {
    return target.listeners.get(name)?.size || 0;
}

test('map gestures are idempotent and fully disposable', () => {
    const map = eventTarget();
    const browser = eventTarget();

    global.window = global;
    global.navigator = { hardwareConcurrency: 8 };
    global.addEventListener = browser.addEventListener.bind(browser);
    global.removeEventListener = browser.removeEventListener.bind(browser);
    global.document = {
        getElementById(id) { return id === 'graphArea' ? map : null; },
    };
    global.requestAnimationFrame = () => 1;
    global.cancelAnimationFrame = () => {};

    const source = fs.readFileSync(
        path.join(__dirname, '../../AgeOfLiberty/wwwroot/animations2.js'),
        'utf8');
    vm.runInThisContext(source, { filename: 'animations2.js' });

    const dotnet = { invokeMethodAsync: () => Promise.resolve() };
    AgeOfLiberty.initTouchGestures('graphArea', dotnet, 0, 0, 1);
    AgeOfLiberty.initTouchGestures('graphArea', dotnet, 10, 20, 1.5);

    assert.equal(listenerCount(map, 'touchmove'), 1);
    assert.equal(listenerCount(map, 'wheel'), 1);
    assert.equal(listenerCount(browser, 'mousemove'), 1);
    assert.equal(listenerCount(browser, 'mouseup'), 1);

    AgeOfLiberty.destroyTouchGestures();

    assert.equal(listenerCount(map, 'touchmove'), 0);
    assert.equal(listenerCount(map, 'wheel'), 0);
    assert.equal(listenerCount(browser, 'mousemove'), 0);
    assert.equal(listenerCount(browser, 'mouseup'), 0);

    AgeOfLiberty.initTouchGestures('graphArea', dotnet, 0, 0, 1);
    AgeOfLiberty.dispose();
    assert.equal(listenerCount(map, 'touchmove'), 0);
    assert.equal(listenerCount(browser, 'mousemove'), 0);
});
