'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const filters = require('../src/renderer/filters.js');
const matcher = require('../src/renderer/matcher.js');

function gradient(width = 56, height = 42) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    data[i] = 38 + x * 2; data[i + 1] = 57 + y * 3;
    data[i + 2] = 75 + Math.floor((x + y) * 1.3);
    data[i + 3] = 255;
  }
  return { width, height, data };
}
test('unchanged reference returns zero mean squared error', () => {
  const source = gradient();
  const outcome = matcher.fitReference(source, source);
  assert.equal(outcome.baselineMSE, 0);
  assert.equal(outcome.matchedMSE, 0);
  assert.equal(outcome.improvement, 0);
});
test('reference look search improves a known global warm-tone transformation', () => {
  const source = gradient();
  const desired = filters.applyFilters(source, { exposure: 23, temperature: 27, saturation: 16 });
  const initial = source.data.slice();
  const result = matcher.fitReference(source, desired);
  assert.ok(result.baselineMSE > result.matchedMSE);
  assert.ok(result.improvement >= 30);
  assert.deepEqual(source.data, initial);
  assert.equal(result.settings.bloom, 0);
  assert.equal(result.settings.grain, 0);
});
test('tonal zone analysis classifies each opaque pixel once', () => {
  const before = gradient(4, 3);
  const after = filters.applyFilters(before, { temperature: 20 });
  const zones = matcher.analyzePair(before, after);
  assert.equal(zones.length, 3);
  assert.equal(zones.reduce((sum, zone) => sum + zone.pixels, 0), 12);
  assert.ok(zones.every(zone => Number.isInteger(zone.meanAbsoluteDifference)));
});
test('subsample uses same coordinate mapping for both images', () => {
  const source = gradient(300, 200);
  const sampled = matcher.subsamplePair(source, source, 72);
  assert.ok(Math.max(sampled.before.width, sampled.before.height) <= 72);
  assert.deepEqual(sampled.before.data, sampled.reference.data);
});
test('mismatched resolution and broken alpha data are rejected', () => {
  const source = gradient(3, 3), other = gradient(4, 3);
  assert.throws(() => matcher.fitReference(source, other), RangeError);
  assert.throws(() => matcher.analyzePair(source, {width:3,height:3,data:[]}), RangeError);
});
