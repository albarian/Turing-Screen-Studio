import assert from 'node:assert/strict';
import test from 'node:test';
import { ScreenRenderer } from '../src/services/screenRenderer.ts';
import { TuringSerialDriver } from '../src/services/turingProtocol.ts';
import {
  toggleOrientationDirection,
  toggleOrientationShape,
} from '../src/types/screen.ts';

const orientations = [
  ['portrait', 320, 480, 0],
  ['reverse_portrait', 320, 480, 1],
  ['landscape', 480, 320, 2],
  ['reverse_landscape', 480, 320, 3],
];

test('orientation controls reach all four combinations and reset correctly', () => {
  for (const [orientation] of orientations) {
    assert.equal(toggleOrientationDirection(toggleOrientationDirection(orientation)), orientation);
    assert.equal(toggleOrientationShape(toggleOrientationShape(orientation)), orientation);
    assert.equal(
      toggleOrientationShape(toggleOrientationDirection(orientation)),
      toggleOrientationDirection(toggleOrientationShape(orientation))
    );
  }
});

test('renderer uses the correct canvas dimensions for every orientation', () => {
  const context = { setTransform() {}, fillRect() {} };
  const canvas = { width: 0, height: 0, getContext: () => context };
  for (const [orientation, width, height] of orientations) {
    ScreenRenderer.render(canvas, { orientation, testPattern: 'white' }, null, null, null, null, null, null, null);
    assert.deepEqual([canvas.width, canvas.height], [width, height], orientation);
  }
});

test('serial frames use base orientation packets and rotate pixels for both protocols', async () => {
  for (const protocol of ['turing_standard', 'xuanfang_rev_b']) {
    for (const [orientation, width, height, code] of orientations) {
      const pixels = new Uint8ClampedArray(width * height * 4);
      pixels.set([255, 0, 0, 255], 0);
      pixels.set([0, 0, 255, 255], pixels.length - 4);
      const canvas = {
        getContext: () => ({ getImageData: () => ({ data: pixels }) }),
      };
      const writes = [];
      const driver = new TuringSerialDriver();
      driver.isConnected = true;
      driver.writer = { write: async (bytes) => writes.push(Uint8Array.from(bytes)) };
      const config = {
        orientation,
        protocol,
        endianness: 'big',
        colorOrder: 'rgb',
        transmissionMode: 'monolithic_block',
      };
      assert.equal(await driver.sendCanvasFrame(canvas, config), true);
      if (protocol === 'turing_standard') {
        assert.equal(writes[0][6], 100 + (width === 320 ? 0 : 2), orientation);
        assert.deepEqual([...writes[0].slice(7, 11)], [width >> 8, width & 255, height >> 8, height & 255]);
      } else {
        assert.equal(writes[0][1], width === 320 ? 0 : 1, orientation);
      }
      const frame = writes[1];
      const headerLength = protocol === 'turing_standard' ? 6 : 10;
      const expectedFirstPixel = code % 2 === 1
        ? [0x00, 0x1f]
        : [0xf8, 0x00];
      assert.deepEqual([...frame.slice(headerLength, headerLength + 2)], expectedFirstPixel, orientation);
    }
  }
});

test('Rev A rotation and reset send opposite pixels without changing screen shape', async () => {
  const width = 320;
  const height = 480;
  const pixels = new Uint8ClampedArray(width * height * 4);
  pixels.set([255, 0, 0, 255], 0);
  pixels.set([0, 0, 255, 255], pixels.length - 4);
  const canvas = { getContext: () => ({ getImageData: () => ({ data: pixels }) }) };
  const writes = [];
  const driver = new TuringSerialDriver();
  driver.isConnected = true;
  driver.writer = { write: async (bytes) => writes.push(Uint8Array.from(bytes)) };
  const config = {
    orientation: 'portrait',
    protocol: 'turing_standard',
    endianness: 'big',
    colorOrder: 'rgb',
    transmissionMode: 'monolithic_block',
  };
  for (const orientation of ['portrait', 'reverse_portrait', 'portrait']) {
    assert.equal(await driver.sendCanvasFrame(canvas, { ...config, orientation }), true);
  }
  assert.equal(writes.length, 4);
  assert.equal(writes[0][6], 100);
  assert.deepEqual([...writes[1].slice(6, 8)], [0xf8, 0x00]);
  assert.deepEqual([...writes[2].slice(6, 8)], [0x00, 0x1f]);
  assert.deepEqual([...writes[3].slice(6, 8)], [0xf8, 0x00]);
});

test('bridge sends base orientation and rotated Rev A pixels', async () => {
  const pixels = new Uint8ClampedArray(320 * 480 * 4);
  pixels.set([255, 0, 0, 255], 0);
  pixels.set([0, 0, 255, 255], pixels.length - 4);
  const canvas = { getContext: () => ({ getImageData: () => ({ data: pixels }) }) };
  const driver = new TuringSerialDriver();
  driver.isConnected = true;
  driver.transport = 'bridge';
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, ...options };
    return { ok: true };
  };
  try {
    assert.equal(await driver.sendCanvasFrame(canvas, {
      orientation: 'reverse_portrait',
      protocol: 'turing_standard',
      endianness: 'big',
      colorOrder: 'rgb',
    }), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(request.headers['X-Orientation'], 'portrait');
  assert.deepEqual([...request.body.slice(0, 2)], [0x00, 0x1f]);
});
