/* pixel-rounded / deterministic, dependency-free sRGB pixel pipeline. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PixelRoundedFilters = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const DEFAULTS = Object.freeze({
    exposure: 0, contrast: 0, saturation: 0, temperature: 0,
    grain: 0, bloom: 0, fade: 0, vignette: 0, pixelate: 0, roundness: 55
  });
  const PRESETS = Object.freeze({
    natural: { name: '원본 느낌', caption: 'Natural daylight', values: {} },
    sunday: { name: '아날로그의 오후', caption: 'Analog Sunday', values: { temperature: 34, fade: 19, grain: 16, bloom: 22, saturation: -9 } },
    velvet: { name: '벨벳 필름', caption: 'Velvet Film', values: { contrast: -19, fade: 31, saturation: -22, temperature: 12, grain: 26, vignette: 24 } },
    blossom: { name: '봄날의 빛', caption: 'Spring Bloom', values: { exposure: 11, saturation: 12, temperature: 17, bloom: 49, fade: 7 } },
    monochrome: { name: '모노 노트', caption: 'Mono Note', values: { saturation: -100, contrast: 21, grain: 15, vignette: 33 } },
    lavender: { name: '라벤더 아워', caption: 'Lavender Hour', values: { saturation: -11, temperature: -23, bloom: 32, fade: 14 } },
    rounded: { name: '둥근 픽셀', caption: 'Rounded Pixels', values: { pixelate: 48, roundness: 75, saturation: 12 } }
  });
  function clamp(value, low, high) { return Math.min(high, Math.max(low, value)); }
  function optionsFor(values) {
    const options = {};
    for (const [key, value] of Object.entries(DEFAULTS)) {
      const candidate = Number(values && values[key]);
      options[key] = Number.isFinite(candidate) ? clamp(candidate, key === 'roundness' || key === 'grain' ||
        key === 'bloom' || key === 'fade' || key === 'vignette' || key === 'pixelate' ? 0 : -100, 100) : value;
    }
    return options;
  }
  function presetValues(id) {
    return optionsFor(PRESETS[id] ? PRESETS[id].values : {});
  }
  function hashNoise(x, y, seed) {
    let n = Math.imul(x + 11939, 374761393) + Math.imul(y + 27183, 668265263) + Math.imul(seed, 1013904223);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    n ^= n >>> 16;
    return (n >>> 0) / 4294967295 - 0.5;
  }
  // Anti-aliased rounded cell mask; original alpha is never changed.
  function roundedMosaic(buffer, width, height, size, roundness) {
    const source = buffer.slice();
    const radius = clamp(roundness / 100, 0, 1) * size / 2;
    for (let by = 0; by < height; by += size) {
      for (let bx = 0; bx < width; bx += size) {
        const endY = Math.min(height, by + size);
        const endX = Math.min(width, bx + size);
        let red = 0, green = 0, blue = 0, alpha = 0;
        for (let y = by; y < endY; y++) {
          for (let x = bx; x < endX; x++) {
            const i = (y * width + x) * 4, a = source[i + 3] / 255;
            red += source[i] * a; green += source[i + 1] * a; blue += source[i + 2] * a; alpha += a;
          }
        }
        if (alpha <= 0) continue;
        const avg = [red / alpha, green / alpha, blue / alpha];
        const cellW = endX - bx, cellH = endY - by;
        const rr = Math.min(radius, cellW / 2, cellH / 2);
        for (let y = by; y < endY; y++) {
          for (let x = bx; x < endX; x++) {
            const i = (y * width + x) * 4;
            const dx = Math.max(rr - (x - bx + 0.5), 0, (x - bx + 0.5) - (cellW - rr));
            const dy = Math.max(rr - (y - by + 0.5), 0, (y - by + 0.5) - (cellH - rr));
            const inside = rr === 0 ? 1 : clamp(rr - Math.hypot(dx, dy) + 0.5, 0, 1);
            const mix = inside;
            // Gaps retain a darkened version of the original image instead of becoming transparent.
            for (let c = 0; c < 3; c++) buffer[i + c] = avg[c] * mix + source[i + c] * (1 - mix) * 0.36;
          }
        }
      }
    }
  }
  function applyBloom(data, width, height, strength) {
    const source = data.slice(), scale = strength / 100 * 0.7;
    if (!strength) return;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0, count = 0;
        for (let dy = -2; dy <= 2; dy += 2) {
          for (let dx = -2; dx <= 2; dx += 2) {
            const yy = clamp(y + dy, 0, height - 1), xx = clamp(x + dx, 0, width - 1);
            const i = (yy * width + xx) * 4;
            const lum = 0.2126 * source[i] + 0.7152 * source[i + 1] + 0.0722 * source[i + 2];
            sum += Math.max(0, lum - 152); count++;
          }
        }
        const glow = (sum / count) * scale;
        const i = (y * width + x) * 4;
        data[i] = clamp(source[i] + glow * 1.10, 0, 255);
        data[i + 1] = clamp(source[i + 1] + glow * 0.89, 0, 255);
        data[i + 2] = clamp(source[i + 2] + glow * 0.78, 0, 255);
      }
    }
  }
  function applyFilters(input, settings, seed = 17) {
    if (!input || !Number.isInteger(input.width) || !Number.isInteger(input.height) ||
        input.width < 1 || input.height < 1 || input.width * input.height > 24000000 ||
        !input.data || input.data.length !== input.width * input.height * 4) {
      throw new RangeError('ImageData dimensions or pixel buffer are invalid (maximum 24 megapixels).');
    }
    const width = input.width, height = input.height, src = input.data;
    const o = optionsFor(settings);
    const data = new Uint8ClampedArray(src.length);
    const exposureGain = Math.pow(2, o.exposure / 100);
    const warm = o.temperature * 0.44;
    const contrastGain = Math.max(0.05, 1 + o.contrast / 72);
    const saturationGain = Math.max(0, 1 + o.saturation / 100);
    const fade = o.fade / 100;
    const fadeGain = 1 - fade * 0.14;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        let r = src[i] * exposureGain + warm;
        let g = src[i + 1] * exposureGain + warm * 0.07;
        let b = src[i + 2] * exposureGain - warm;
        r = (r - 127.5) * contrastGain + 127.5;
        g = (g - 127.5) * contrastGain + 127.5;
        b = (b - 127.5) * contrastGain + 127.5;
        const lum = r * 0.2126 + g * 0.7152 + b * 0.0722;
        r = lum + (r - lum) * saturationGain;
        g = lum + (g - lum) * saturationGain;
        b = lum + (b - lum) * saturationGain;
        data[i] = clamp(r * fadeGain + fade * 36, 0, 255);
        data[i + 1] = clamp(g * fadeGain + fade * 31, 0, 255);
        data[i + 2] = clamp(b * fadeGain + fade * 32, 0, 255);
        data[i + 3] = src[i + 3];
      }
    }
    if (o.bloom > 0) applyBloom(data, width, height, o.bloom);
    if (o.pixelate > 0) roundedMosaic(data, width, height, Math.max(2, Math.round(o.pixelate / 4) + 1), o.roundness);
    if (o.vignette > 0 || o.grain > 0) {
      const invW = 2 / width, invH = 2 / height;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const dx = (x + .5) * invW - 1, dy = (y + .5) * invH - 1;
          const edge = Math.max(0, (dx * dx + dy * dy) / 2 - .13);
          const light = clamp(1 - edge * o.vignette / 75, .15, 1);
          const noise = hashNoise(x, y, seed) * o.grain * .48;
          for (let c = 0; c < 3; c++) data[i + c] = clamp(data[i + c] * light + noise, 0, 255);
        }
      }
    }
    return { data, width, height };
  }
  function classifyPixel(r, g, b) {
    const luma = Math.round(r * .2126 + g * .7152 + b * .0722);
    const range = Math.max(r, g, b) - Math.min(r, g, b);
    const tone = luma < 85 ? '그림자' : luma > 181 ? '하이라이트' : '중간톤';
    const chroma = range < 20 ? '무채색' : r - b > 38 ? '따뜻한 색' : b - r > 38 ? '차가운 색' : '중성 색';
    return { tone, chroma, luma };
  }
  function inspectPixel(imageData, x, y) {
    const px = Math.floor(x), py = Math.floor(y);
    if (!imageData || px < 0 || py < 0 || px >= imageData.width || py >= imageData.height) return null;
    const i = (py * imageData.width + px) * 4;
    const [r, g, b, a] = Array.from(imageData.data.slice(i, i + 4));
    const hex = '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase();
    return { x: px, y: py, r, g, b, a, hex, ...classifyPixel(r, g, b) };
  }
  function analyzeImage(imageData, maxSamples = 10000) {
    if (!imageData || !imageData.data || !imageData.width || !imageData.height) return null;
    const count = imageData.width * imageData.height;
    const step = Math.max(1, Math.floor(count / maxSamples));
    let samples = 0, shadows = 0, midtones = 0, highlights = 0, red = 0, green = 0, blue = 0;
    for (let i = 0; i < count; i += step) {
      const off = i * 4;
      if (imageData.data[off + 3] === 0) continue;
      const r = imageData.data[off], g = imageData.data[off + 1], b = imageData.data[off + 2];
      red += r; green += g; blue += b; samples++;
      const lum = r * .2126 + g * .7152 + b * .0722;
      if (lum < 85) shadows++; else if (lum > 181) highlights++; else midtones++;
    }
    if (!samples) return null;
    return { samples, shadows: Math.round(100 * shadows / samples), midtones: Math.round(100 * midtones / samples),
      highlights: Math.round(100 * highlights / samples),
      average: [Math.round(red / samples), Math.round(green / samples), Math.round(blue / samples)] };
  }
  return Object.freeze({ DEFAULTS, PRESETS, clamp, optionsFor, presetValues, applyFilters, classifyPixel, inspectPixel, analyzeImage });
});
