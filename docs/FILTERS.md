# 필터 엔진 명세 · Pixel Processing API

## 진입점

- `filters.js`: 브라우저 전역 `window.PixelRoundedFilters` 또는 CommonJS `require()`
- `matcher.js`: 브라우저 전역 `window.PixelRoundedMatcher` 또는 CommonJS `require()`
- 외부 라이브러리 필요 없음; 픽셀 입력 형태는 `{width, height, data: Uint8ClampedArray}`
- `applyFilters(input, settings, seed=17)`는 새 버퍼를 돌려주며 원본은 수정하지 않음

## 픽셀 파이프라인 순서

```text
RGB + alpha
  ↓ exposure: ×2^(EV/100)
  ↓ temperature: red/blue offset
  ↓ contrast: mid-gray pivot
  ↓ saturation: luma-relative scale
  ↓ fade: lift blacks
  ↓ bloom: 3×3 luminance threshold (~152)
  ↓ rounded mosaic: block-average + anti-alias mask (optional)
  ↓ vignette: normalized radial falloff
  ↓ grain: deterministic (x,y,seed) hash
  ↓ 0–255 clamp, alpha preserved
```

**순서가 다르면 결과도 달라집니다.** 8bit sRGB 좌표의 빠른 실시간 미리보기를 목표로 설계했으며 물리적으로 선형 광량 공간에서 처리하는 전문 색보정 도구와 동일하지 않습니다.

## 매개변수 (실제 UI)

| Key | 범위 | 기본 | 동작 |
|---|---:|---:|---|
| exposure | -100..100 | 0 | 유사 노출 |
| contrast | -100..100 | 0 | 중간 회색 피벗 |
| saturation | -100..100 | 0 | -100이면 모노 |
| temperature | -100..100 | 0 | 빨강 / 파랑 오프셋 |
| grain | 0..100 | 0 | 반복 가능한 입자 |
| bloom | 0..100 | 0 | 하이라이트 번짐 |
| fade | 0..100 | 0 | 블랙 리프트 |
| vignette | 0..100 | 0 | 중심→가장자리 광량 저하 |
| pixelate | 0..100 | 0 | 셀 크기 2–26px |
| roundness | 0..100 | 55 | 블록 코너 반경 |

## 전후 레퍼런스 정합

`fitReference(before, after)`는 동일 치수의 사진 두 장을 최대 약 82px 변에 다운샘플링한 다음, 전역 변수 6개(노출, 대비, 채도, 온도, 페이드, 비네팅)에 대해 단계별 좌표 강하 탐색을 수행합니다.

```text
baseline = MSE(original pixels, reference pixels)
candidate = applyFilters(original, estimated settings)
match = argmin MSE(candidate, reference)
improvement = 100 × (1 - matchedMSE / baselineMSE)
```

숫자는 **픽셀 제곱 오차가 감소한 비율**이며 사진의 정확도/유사도 백분율이나 ML confidence가 아닙니다. 밝은 점의 위치가 달라지는 움직임, 피사체 교체, 노출 합성은 자동으로 재현하지 못합니다.

입력 그림자/중간톤/하이라이트 3영역의 `colorDelta[R,G,B]` 및 픽셀당 평균 절대 오차도 반환합니다.

## 용량과 시간 복잡도

- 사진 입력: 최대 36MiB
- 디코딩 이미지: 최대 24MP
- 미리보기: 최장 변 1400px
- 저장: 원본 가로×세로 전체 해상도 (메모리 사용 높음)
- 색변환: O(W×H), 블룸: 최대 9 인접 샘플/픽셀, 참조 최적화: 작은 샘플 이미지에서 여러 번 반복
- 원본 픽셀은 불변; 편집본은 새 Uint8ClampedArray 생성

## 보안과 유효성

`applyFilters`는 데이터 길이·크기를 검증하고 상한을 넘는 경우 RangeError를 던집니다. 참조 정합은 두 배열의 크기와 RGBA 길이가 일치해야 작동합니다. 1px 좌표 검사 메서드 `inspectPixel`은 경계 밖이면 null을 반환합니다.

## 미구현

지역 마스크 자동 생성, RAW 파일, EXIF 복원, ICC 변환, CUDA/WebGPU, 오디오/동영상, 타인의 사진에서 임의 필터를 독립적으로 복제할 법적 권리 판정은 구현되어 있지 않습니다.
