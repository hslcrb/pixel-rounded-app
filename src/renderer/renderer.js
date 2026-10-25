/* pixel-rounded: local-first image editor controller. No Node APIs or network access. */
(() => {
  'use strict';
  const engine = window.PixelRoundedFilters;
  const matcher = window.PixelRoundedMatcher;
  if (!engine || !matcher) throw new Error('The pixel filter and reference matching engines must be loaded.');
  const $ = id => document.getElementById(id);
  const els = {
    frame: $('preview-frame'), stage: $('stage'),
    before: $('before-canvas'), after: $('after-canvas'),
    status: $('status-text'), dim: $('dimension-text'),
    title: $('project-title'), open: $('open-btn'), export: $('export-btn'),
    input: $('file-input'), format: $('format-select'),
    zoomLabel: $('zoom-label'), undo: $('undo-btn'), redo: $('redo-btn'),
    compare: $('compare-toggle'), grid: $('grid-toggle')
  };
  const MAX_FILE = 36 * 1024 * 1024, MAX_PIXELS = 24000000, PREVIEW_EDGE = 1400;
  const acceptedTypes = ['image/png', 'image/jpeg', 'image/webp'];
  let originalImage = null, originalName = '', activeBlobUrl = null;
  let originalPreview = null, processedPreview = null;
  let options = engine.presetValues('natural'), compareMode = true;
  let split = 50, zoomFactor = 1, gridMode = false, dragging = false;
  let renderTimer = null, working = false, toastTimer = null;
  let history = [Object.assign({}, options)], historyIndex = 0;

  function setStatus(message) { els.status.textContent = message; }
  function notify(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3600);
  }
  function fail(error) {
    const text = error && error.message ? error.message : String(error);
    setStatus('오류 · ' + text);
    notify('앗, ' + text);
  }
  function setWorking(value, label) {
    working = value;
    els.export.disabled = value || !originalImage;
    els.open.disabled = value;
    if (label) setStatus(label);
  }
  function drawPixels(canvas, pixels) {
    canvas.width = pixels.width;
    canvas.height = pixels.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.putImageData(new ImageData(pixels.data, pixels.width, pixels.height), 0, 0);
  }
  function updateSliderUI() {
    document.querySelectorAll('[data-setting]').forEach(input => {
      const key = input.dataset.setting;
      input.value = String(options[key]);
      const output = document.querySelector('[data-output="' + key + '"]');
      if (output) output.textContent = String(options[key]);
      const lo = Number(input.min), hi = Number(input.max);
      const percent = (options[key] - lo) * 100 / (hi - lo);
      input.style.background = 'linear-gradient(to right, #b9a2ff 0 ' + percent + '%, #494655 ' + percent + '% 100%)';
      input.style.appearance = 'none';
    });
  }
  function updatePresetButtons(activeName) {
    document.querySelectorAll('[data-preset]').forEach(button => {
      const selected = button.dataset.preset === activeName;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }
  function updateHistory() {
    els.undo.disabled = historyIndex <= 0;
    els.redo.disabled = historyIndex >= history.length - 1;
  }
  function saveHistory() {
    const next = Object.assign({}, options);
    if (JSON.stringify(history[historyIndex]) === JSON.stringify(next)) return;
    history = history.slice(0, historyIndex + 1);
    history.push(next);
    if (history.length > 40) history.shift();
    historyIndex = history.length - 1;
    updateHistory();
  }
  function travelHistory(direction) {
    const target = historyIndex + direction;
    if (target < 0 || target >= history.length) return;
    historyIndex = target;
    options = Object.assign({}, history[historyIndex]);
    updateHistory(); updateSliderUI();
    updatePresetButtons('');
    scheduleRender();
  }
  function choosePreset(preset) {
    if (!engine.PRESETS[preset]) return;
    options = engine.presetValues(preset);
    updateSliderUI();
    updatePresetButtons(preset);
    saveHistory();
    scheduleRender();
    notify('✳  ' + engine.PRESETS[preset].name + ' 필터를 적용했어요.');
  }
  function updateToneStats(output) {
    const stats = engine.analyzeImage(output);
    if (!stats) return;
    $('pixel-count').textContent = stats.samples.toLocaleString('ko-KR') + ' 픽셀 표본';
    $('tone-shadow').style.width = stats.shadows + '%';
    $('tone-mid').style.width = stats.midtones + '%';
    $('tone-high').style.width = stats.highlights + '%';
  }
  function renderPreview() {
    renderTimer = null;
    if (!originalPreview) return;
    try {
      setWorking(true, '픽셀 하나하나를 조율하는 중...');
      processedPreview = engine.applyFilters(originalPreview, options);
      drawPixels(els.after, processedPreview);
      updateToneStats(processedPreview);
      setWorking(false, '편집 완료 · 모든 픽셀은 기기 안에서 처리했어요.');
    } catch (error) { setWorking(false); fail(error); }
  }
  function scheduleRender() {
    if (!originalPreview) return;
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderPreview, 105);
  }
  function resizePreview() {
    if (!originalPreview) return;
    const maxWidth = Math.max(240, els.stage.clientWidth - 42);
    const maxHeight = Math.max(160, els.stage.clientHeight - 36);
    const ratio = originalPreview.width / originalPreview.height;
    const fitW = Math.max(1, Math.min(maxWidth, maxHeight * ratio));
    const w = Math.round(fitW * zoomFactor), h = Math.round(w / ratio);
    els.frame.style.width = w + 'px';
    els.frame.style.height = h + 'px';
    $('pixel-grid').style.backgroundSize = (w / originalPreview.width) + 'px ' + (h / originalPreview.height) + 'px';
    els.zoomLabel.textContent = zoomFactor === 1 ? '맞춤' : Math.round(zoomFactor * 100) + '%';
    const visibleGrid = gridMode && zoomFactor >= 3;
    els.frame.classList.toggle('grid-on', visibleGrid);
  }
  function setSplit(percent) {
    split = engine.clamp(percent, 0, 100);
    els.frame.style.setProperty('--split', split + '%');
  }
  function updateCompareMode() {
    els.frame.classList.toggle('comparison-off', !compareMode);
    els.compare.setAttribute('aria-pressed', String(compareMode));
  }
  function inspectPointer(event) {
    if (!processedPreview || !originalPreview) return;
    const bounds = els.frame.getBoundingClientRect();
    const nx = (event.clientX - bounds.left) / bounds.width;
    const ny = (event.clientY - bounds.top) / bounds.height;
    if (nx < 0 || nx >= 1 || ny < 0 || ny >= 1) return;
    const px = Math.min(processedPreview.width - 1, Math.floor(nx * processedPreview.width));
    const py = Math.min(processedPreview.height - 1, Math.floor(ny * processedPreview.height));
    const result = engine.inspectPixel(processedPreview, px, py);
    const before = engine.inspectPixel(originalPreview, px, py);
    if (!result || !before) return;
    const fullX = Math.min(originalImage.naturalWidth - 1, Math.floor(nx * originalImage.naturalWidth));
    const fullY = Math.min(originalImage.naturalHeight - 1, Math.floor(ny * originalImage.naturalHeight));
    $('pixel-coordinate').textContent = 'X ' + fullX + '  Y ' + fullY;
    $('pixel-color').style.backgroundColor = result.hex;
    $('pixel-hex').textContent = result.hex;
    $('pixel-type').textContent = before.hex + ' → ' + result.hex + ' · ' + result.tone + ' · ' + result.chroma + ' (' + result.luma + ')';
  }
  function displayImage(image, name) {
    const pixelCount = image.naturalWidth * image.naturalHeight;
    if (!pixelCount || pixelCount > MAX_PIXELS) {
      throw new Error('현재는 최대 2,400만 픽셀까지 편집할 수 있어요.');
    }
    const scale = Math.min(1, PREVIEW_EDGE / image.naturalWidth, PREVIEW_EDGE / image.naturalHeight);
    const w = Math.max(1, Math.round(image.naturalWidth * scale));
    const h = Math.max(1, Math.round(image.naturalHeight * scale));
    const scratch = document.createElement('canvas');
    scratch.width = w; scratch.height = h;
    const ctx = scratch.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, w, h);
    originalPreview = ctx.getImageData(0, 0, w, h);
    originalImage = image;
    originalName = name;
    $('reference-result').textContent = '새 원본 사진 · 참조 사진을 선택할 수 있어요.';
    els.title.textContent = name;
    els.dim.textContent = image.naturalWidth.toLocaleString('ko-KR') + ' × ' + image.naturalHeight.toLocaleString('ko-KR') + ' px  ·  로컬 처리';
    drawPixels(els.before, originalPreview);
    zoomFactor = 1;
    resizePreview();
    renderPreview();
  }
  function loadImage(src, name) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        try { displayImage(image, name); resolve(); } catch (error) { reject(error); }
      };
      image.onerror = () => reject(new Error('이미지를 읽을 수 없어요. 지원 포맷을 확인해 주세요.'));
      image.src = src;
    });
  }
  async function loadFile(file) {
    if (!file || !acceptedTypes.includes(file.type)) throw new Error('PNG, JPG, WebP 이미지만 지원해요.');
    if (file.size > MAX_FILE) throw new Error('파일은 36MB 이하여야 해요.');
    const url = URL.createObjectURL(file);
    try {
      await loadImage(url, file.name);
      if (activeBlobUrl) URL.revokeObjectURL(activeBlobUrl);
      activeBlobUrl = url;
    } catch (error) { URL.revokeObjectURL(url); throw error; }
  }

  async function matchReferencePhoto(file) {
    if (!originalPreview) throw new Error('먼저 원본 사진을 열어주세요.');
    if (!file || !acceptedTypes.includes(file.type)) throw new Error('PNG, JPG, WebP 사진만 비교할 수 있어요.');
    if (file.size > MAX_FILE) throw new Error('참조 사진은 36MB 이하여야 해요.');
    const blobURL = URL.createObjectURL(file);
    setWorking(true, '두 사진의 픽셀을 대조하는 중...');
    try {
      const image = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('참조 사진을 열 수 없어요.'));
        image.src = blobURL;
      });
      const expectedRatio = originalImage.naturalWidth / originalImage.naturalHeight;
      const givenRatio = image.naturalWidth / image.naturalHeight;
      if (Math.abs(expectedRatio - givenRatio) / expectedRatio > .025) {
        throw new Error('원본과 참조 사진의 가로세로 비율이 달라요. 같은 장면을 맞춰주세요.');
      }
      const scratch = document.createElement('canvas');
      scratch.width = originalPreview.width;
      scratch.height = originalPreview.height;
      const ctx = scratch.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, 0, 0, scratch.width, scratch.height);
      const reference = ctx.getImageData(0, 0, scratch.width, scratch.height);
      await new Promise(resolve => setTimeout(resolve, 30));
      const outcome = matcher.fitReference(originalPreview, reference, { maxEdge: 82 });
      options = outcome.settings;
      updateSliderUI();
      updatePresetButtons('');
      saveHistory();
      const middle = outcome.zones.find(zone => zone.key === 'midtone');
      $('reference-result').textContent = '✓ ' + file.name + ' · 픽셀 오차 ' + outcome.improvement +
        '% 감소 (' + outcome.sampledPixels.toLocaleString('ko-KR') + ' 표본) · 중간톤 ΔRGB ' +
        middle.colorDelta.join(' / ') + '. 전역 색감 추정이며 세밀한 국소 보정은 수동으로 조정하세요.';
      scheduleRender();
      notify('✳  전후 이미지 분석으로 색감 필터를 만들었어요.');
    } finally {
      URL.revokeObjectURL(blobURL);
      setWorking(false);
    }
  }

  async function openImage() {
    if (working) return;
    if (window.pixelRounded) {
      try {
        const picked = await window.pixelRounded.openImage();
        if (picked) {
          await loadImage(picked.dataUrl, picked.name);
          if (activeBlobUrl) { URL.revokeObjectURL(activeBlobUrl); activeBlobUrl = null; }
        }
      } catch (error) { fail(error); }
    } else { els.input.click(); }
  }
  async function exportImage() {
    if (!originalImage || working) return;
    try {
      setWorking(true, '원본 해상도로 사진을 내보내는 중...');
      // Permit a paint frame so the user sees the busy status before the CPU-intensive pass.
      await new Promise(resolve => setTimeout(resolve, 40));
      const canvas = document.createElement('canvas');
      canvas.width = originalImage.naturalWidth; canvas.height = originalImage.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(originalImage, 0, 0);
      const original = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const processed = engine.applyFilters(original, options);
      ctx.putImageData(new ImageData(processed.data, canvas.width, canvas.height), 0, 0);
      let dataUrl, format = els.format.value;
      if (format === 'jpeg') {
        const flatten = document.createElement('canvas');
        flatten.width = canvas.width; flatten.height = canvas.height;
        const fctx = flatten.getContext('2d');
        fctx.fillStyle = '#ffffff'; fctx.fillRect(0, 0, flatten.width, flatten.height);
        fctx.drawImage(canvas, 0, 0);
        dataUrl = flatten.toDataURL('image/jpeg', .92);
      } else {
        format = 'png';
        dataUrl = canvas.toDataURL('image/png');
      }
      if (window.pixelRounded) {
        const result = await window.pixelRounded.saveImage({ dataUrl, format });
        if (!result.canceled) { setStatus('사진 저장 완료 · ' + result.name); notify('♡ 사진을 저장했어요!'); }
        else setStatus('내보내기를 취소했어요.');
      } else {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'pixel-rounded-' + originalName.replace(/\.[^.]+$/, '').replace(/[^\w가-힣-]/g, '_') + '.' + (format === 'png' ? 'png' : 'jpg');
        document.body.appendChild(a); a.click(); a.remove();
        setStatus('사진을 다운로드했어요.');
      }
    } catch (error) { fail(error); } finally { setWorking(false); }
  }
  function zoomBy(factor) {
    zoomFactor = engine.clamp(Math.round(zoomFactor * factor * 100) / 100, .5, 8);
    resizePreview();
    if (gridMode && zoomFactor < 3) notify('격자 표시는 300% 이상 확대했을 때 나타나요.');
  }
  // Left library: accessible native buttons and keyboard activation.
  document.querySelectorAll('[data-preset]').forEach(button =>
    button.addEventListener('click', () => choosePreset(button.dataset.preset))
  );
  document.querySelectorAll('[data-setting]').forEach(input => {
    input.addEventListener('input', () => {
      options[input.dataset.setting] = Number(input.value);
      updatePresetButtons('');
      updateSliderUI();
      scheduleRender();
    });
    input.addEventListener('change', saveHistory);
  });
  $('reference-btn').addEventListener('click', () => { if (!working) $('reference-input').click(); });
  $('reference-input').addEventListener('change', async event => {
    try { if (event.target.files[0]) await matchReferencePhoto(event.target.files[0]); }
    catch (error) { fail(error); }
    finally { $('reference-input').value = ''; }
  });
  els.open.addEventListener('click', openImage);
  els.export.addEventListener('click', exportImage);
  els.input.addEventListener('change', async event => {
    try { if (event.target.files[0]) await loadFile(event.target.files[0]); }
    catch (error) { fail(error); }
    finally { els.input.value = ''; }
  });
  $('reset-btn').addEventListener('click', () => choosePreset('natural'));
  $('zoom-in').addEventListener('click', () => zoomBy(1.5));
  $('zoom-out').addEventListener('click', () => zoomBy(1 / 1.5));
  $('fit-btn').addEventListener('click', () => { zoomFactor = 1; resizePreview(); });
  els.compare.addEventListener('click', () => { compareMode = !compareMode; updateCompareMode(); });
  els.grid.addEventListener('click', () => {
    gridMode = !gridMode;
    els.grid.setAttribute('aria-pressed', String(gridMode));
    resizePreview();
    if (gridMode && zoomFactor < 3) notify('격자 표시는 300% 이상에서 보여요.');
  });
  els.undo.addEventListener('click', () => travelHistory(-1));
  els.redo.addEventListener('click', () => travelHistory(1));
  els.frame.addEventListener('pointerdown', event => {
    if (!compareMode || event.button !== 0) return;
    dragging = true;
    els.frame.setPointerCapture(event.pointerId);
    const rect = els.frame.getBoundingClientRect();
    setSplit((event.clientX - rect.left) / rect.width * 100);
  });
  els.frame.addEventListener('pointermove', event => {
    inspectPointer(event);
    if (dragging && compareMode) {
      const rect = els.frame.getBoundingClientRect();
      setSplit((event.clientX - rect.left) / rect.width * 100);
    }
  });
  els.frame.addEventListener('pointerup', () => { dragging = false; });
  els.frame.addEventListener('pointercancel', () => { dragging = false; });
  els.frame.addEventListener('keydown', event => {
    if (!compareMode || !['ArrowRight', 'ArrowLeft'].includes(event.key)) return;
    event.preventDefault();
    setSplit(split + (event.key === 'ArrowRight' ? 2 : -2));
  });
  let dragDepth = 0;
  window.addEventListener('dragenter', event => { event.preventDefault(); dragDepth++; els.stage.classList.add('dragging'); });
  window.addEventListener('dragover', event => { event.preventDefault(); });
  window.addEventListener('dragleave', event => {
    event.preventDefault(); dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) els.stage.classList.remove('dragging');
  });
  window.addEventListener('drop', async event => {
    event.preventDefault(); dragDepth = 0; els.stage.classList.remove('dragging');
    try { if (event.dataTransfer.files[0]) await loadFile(event.dataTransfer.files[0]); }
    catch (error) { fail(error); }
  });
  document.addEventListener('keydown', event => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'o') { event.preventDefault(); openImage(); }
    else if (key === 's') { event.preventDefault(); exportImage(); }
    else if (key === 'z') { event.preventDefault(); travelHistory(event.shiftKey ? 1 : -1); }
    else if (key === 'y') { event.preventDefault(); travelHistory(1); }
  });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resizePreview).observe(els.stage);
  window.addEventListener('resize', resizePreview);
  updateSliderUI(); updateHistory(); updateCompareMode(); setSplit(50);
  loadImage('../assets/demo-landscape.svg', '샘플 풍경 · 직접 제작한 일러스트')
    .then(() => setStatus('샘플 준비 완료 · 실제 사진을 열거나 끌어다 놓아보세요.'))
    .catch(fail);
})();
