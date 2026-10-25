/* pixel-rounded / deterministic reference-look matching, pixel by pixel. */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports
    ? require('./filters.js') : root.PixelRoundedFilters);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PixelRoundedMatcher = api;
})(typeof window !== 'undefined' ? window : null, function (filters) {
  'use strict';
  if (!filters) throw new Error('PixelRoundedFilters must load before PixelRoundedMatcher.');
  const CHANNELS = [0, 1, 2];
  const KEYS = Object.freeze(['exposure', 'contrast', 'saturation', 'temperature', 'fade', 'vignette']);
  function checkPair(before, reference) {
    if (!before || !reference || !before.data || !reference.data ||
        !Number.isInteger(before.width) || !Number.isInteger(before.height) ||
        before.width < 1 || before.height < 1 ||
        before.width !== reference.width || before.height !== reference.height ||
        before.data.length !== before.width * before.height * 4 ||
        reference.data.length !== reference.width * reference.height * 4) {
      throw new RangeError('Reference image and original must have equal, valid pixel dimensions.');
    }
  }
  function subsamplePair(before, reference, maxEdge = 82) {
    checkPair(before, reference);
    const scale = Math.min(1, maxEdge / Math.max(before.width, before.height));
    const width = Math.max(1, Math.round(before.width * scale));
    const height = Math.max(1, Math.round(before.height * scale));
    function sample(image) {
      const data = new Uint8ClampedArray(width * height * 4);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const sx = Math.min(image.width - 1, Math.floor((x + .5) / width * image.width));
        const sy = Math.min(image.height - 1, Math.floor((y + .5) / height * image.height));
        const source = (sy * image.width + sx) * 4, dest = (y * width + x) * 4;
        for (let k = 0; k < 4; k++) data[dest + k] = image.data[source + k];
      }
      return { width, height, data };
    }
    return { before: sample(before), reference: sample(reference) };
  }
  function squaredError(output, reference) {
    checkPair(output, reference);
    let error = 0, valid = 0;
    for (let i = 0; i < output.data.length; i += 4) {
      if (output.data[i + 3] < 8 || reference.data[i + 3] < 8) continue;
      for (const channel of CHANNELS) {
        const delta = output.data[i + channel] - reference.data[i + channel];
        error += delta * delta;
      }
      valid++;
    }
    return valid ? error / (valid * 3) : Infinity;
  }
  function analyzePair(before, reference) {
    checkPair(before, reference);
    const zones = [
      { key: 'shadow', label: '그림자', pixels: 0, colorDelta: [0, 0, 0], absDifference: 0 },
      { key: 'midtone', label: '중간톤', pixels: 0, colorDelta: [0, 0, 0], absDifference: 0 },
      { key: 'highlight', label: '하이라이트', pixels: 0, colorDelta: [0, 0, 0], absDifference: 0 }
    ];
    for (let i = 0; i < before.data.length; i += 4) {
      if (before.data[i + 3] < 8 || reference.data[i + 3] < 8) continue;
      const lum = before.data[i] * .2126 + before.data[i + 1] * .7152 + before.data[i + 2] * .0722;
      const z = zones[lum < 85 ? 0 : lum > 181 ? 2 : 1];
      z.pixels++;
      for (const channel of CHANNELS) {
        const delta = reference.data[i + channel] - before.data[i + channel];
        z.colorDelta[channel] += delta;
        z.absDifference += Math.abs(delta);
      }
    }
    return zones.map(z => ({
      key: z.key, label: z.label, pixels: z.pixels,
      colorDelta: z.pixels ? z.colorDelta.map(v => Math.round(v / z.pixels)) : [0, 0, 0],
      meanAbsoluteDifference: z.pixels ? Math.round(z.absDifference / (z.pixels * 3)) : 0
    }));
  }
  function fitReference(before, reference, options = {}) {
    checkPair(before, reference);
    const compact = subsamplePair(before, reference, options.maxEdge || 82);
    let settings = filters.optionsFor(options.initial || {});
    // Fitted controls are global color/tone parameters. Grain and spatial effects remain manual.
    for (const key of KEYS) settings[key] = 0;
    settings.grain = 0; settings.bloom = 0; settings.pixelate = 0;
    settings.roundness = filters.DEFAULTS.roundness;
    const baselineError = squaredError(filters.applyFilters(compact.before, settings), compact.reference);
    let bestError = baselineError;
    const passes = [28, 14, 7, 3];
    const multipliers = { exposure: 1, contrast: 1, saturation: 1.25, temperature: 1.25, fade: .7, vignette: .9 };
    for (const step of passes) {
      for (const key of KEYS) {
        let winner = settings[key], winnerError = bestError;
        for (const multiplier of [-2, -1, 1, 2]) {
          const candidate = Object.assign({}, settings);
          candidate[key] = filters.optionsFor({
            [key]: settings[key] + multiplier * step * multipliers[key]
          })[key];
          const error = squaredError(filters.applyFilters(compact.before, candidate), compact.reference);
          if (error < winnerError - 0.000001) {
            winner = candidate[key];
            winnerError = error;
          }
        }
        settings[key] = winner;
        bestError = winnerError;
      }
    }
    const difference = analyzePair(compact.before, compact.reference);
    return {
      settings: filters.optionsFor(settings),
      baselineMSE: Number(baselineError.toFixed(2)),
      matchedMSE: Number(bestError.toFixed(2)),
      improvement: baselineError > 0 && Number.isFinite(baselineError)
        ? Math.round(Math.max(0, 1 - bestError / baselineError) * 100) : 0,
      sampledPixels: compact.before.width * compact.before.height,
      zones: difference,
      methods: 'deterministic RGB least-squares coordinate descent; tone-parameter estimate, not exact LUT recovery'
    };
  }
  return Object.freeze({ checkPair, subsamplePair, squaredError, analyzePair, fitReference, KEYS });
});
