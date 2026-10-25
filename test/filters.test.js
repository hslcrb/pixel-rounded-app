'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { applyFilters, presetValues, inspectPixel, analyzeImage, classifyPixel, optionsFor, PRESETS } = require('../src/renderer/filters.js');

function image(width, height, rgb = [80, 140, 200]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data.set([...rgb, 255], i);
  return { data, width, height };
}
test('neutral pipeline preserves color and never mutates input', () => {
  const sample = image(4, 3);
  const original = sample.data.slice();
  const out = applyFilters(sample, presetValues('natural'));
  assert.deepEqual(out.data, original);
  assert.deepEqual(sample.data, original);
  assert.notStrictEqual(out.data, sample.data);
});
test('exposure increases brightness without losing alpha', () => {
  const sample = image(2, 1, [32, 45, 64]);
  sample.data[3] = 99;
  const out = applyFilters(sample, { exposure: 45 });
  assert.ok(out.data[0] > sample.data[0]);
  assert.equal(out.data[3], 99);
});
test('minus 100 saturation produces gray pixels', () => {
  const out = applyFilters(image(1, 1, [255, 0, 25]), { saturation: -100 });
  assert.equal(out.data[0], out.data[1]);
  assert.equal(out.data[1], out.data[2]);
});
test('temperature is directionally correct', () => {
  const sample = image(1, 1, [128, 128, 128]);
  const warm = applyFilters(sample, { temperature: 60 });
  const cool = applyFilters(sample, { temperature: -60 });
  assert.ok(warm.data[0] > warm.data[2]);
  assert.ok(cool.data[0] < cool.data[2]);
});
test('grain is reproducible for same seed', () => {
  const sample = image(9, 7);
  assert.deepEqual(applyFilters(sample, { grain: 45 }, 42).data, applyFilters(sample, { grain: 45 }, 42).data);
  assert.notDeepEqual(applyFilters(sample, { grain: 45 }, 42).data, applyFilters(sample, { grain: 45 }, 7).data);
});
test('rounded cells change output and preserve dimensions', () => {
  const sample = image(24, 24, [200, 150, 100]);
  const out = applyFilters(sample, { pixelate: 44, roundness: 95 });
  assert.equal(out.data.length, sample.data.length);
  assert.ok(out.data[0] < sample.data[0]);
  assert.equal(out.data[3], 255);
});
test('bloom lifts highlights more than shadows', () => {
  const light = applyFilters(image(7, 7, [220, 220, 220]), { bloom: 75 });
  const dark = applyFilters(image(7, 7, [35, 35, 35]), { bloom: 75 });
  assert.ok(light.data[0] > 220);
  assert.equal(dark.data[0], 35);
});
test('inspect one exact pixel and classify tonal zone', () => {
  const sample = image(2, 2, [210, 120, 50]);
  const result = inspectPixel(sample, 1, 0);
  assert.equal(result.hex, '#D27832');
  assert.equal(result.chroma, '따뜻한 색');
  assert.equal(inspectPixel(sample, 2, 2), null);
  assert.equal(classifyPixel(0, 0, 0).tone, '그림자');
});
test('sampled statistics account for tones', () => {
  const sample = { width: 3, height: 1, data: new Uint8ClampedArray([0,0,0,255, 128,128,128,255, 255,255,255,255]) };
  const stats = analyzeImage(sample);
  assert.equal(stats.samples, 3);
  assert.equal(stats.shadows + stats.midtones + stats.highlights, 99); // integer percentages round independently
  assert.deepEqual(stats.average, [128, 128, 128]);
});
test('input validation and bounds', () => {
  assert.throws(() => applyFilters({width:1,height:2,data:new Uint8ClampedArray(4)}, {}), RangeError);
  assert.equal(optionsFor({ temperature: 999 }).temperature, 100);
  assert.equal(optionsFor({ exposure: -999 }).exposure, -100);
  assert.ok(Object.keys(PRESETS).length >= 6);
});

test('missing option object preserves nonzero default roundness', () => {
  assert.equal(optionsFor(null).roundness, 55);
  assert.equal(optionsFor({}).roundness, 55);
  assert.equal(optionsFor({ roundness: 0 }).roundness, 0);
});
