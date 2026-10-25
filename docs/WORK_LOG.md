# pixel-rounded 개발 작업 기록 · 2026-10-26

> 작업 목표: Figma 우선 디자인, Electron 사진 편집기, 픽셀 단위 변화 연구 및 Before/After 레퍼런스 필터 추정, 협업과 권리 문서화.

## 0. 시작 상태

- GitHub: [hslcrb/pixel-rounded-app](https://github.com/hslcrb/pixel-rounded-app)
- 기본 브랜치 `main`에는 파일 한 개(`README.md`, `# pixel-rounded-app`)만 존재.
- 목표 브랜치 접두어: `chatgpt-extrahigh/`
- Figma 팀: Ordo Novus. 작업할 프로젝트 ID: `677481123`.
- 라이선스는 재배포/상업 이용 제한을 원하는 요구를 수용하여 PR-SAL-1.0 **source-available** 초안으로 구현. OSI 오픈소스는 아님.

## 1. Figma 디자인을 먼저 제작

- 파일: [pixel-rounded Photo Lab / Design System](https://www.figma.com/design/cBXdSYzTdooU7EVYU2bMnV)
- 새 파일을 지정 팀 폴더에 생성.
- 1440×900 데스크톱 편집기 UI, 2×2 라운드 픽셀 심볼과 별도 브랜드 보드 제작.
- 라벤더 #B9A2FF, 피치 #FFD6C0, 배경 #11131B 기반 시각 체계 결정.
- 이미지 전후 분할, 필터 프리셋, 조절 패널, 하단 이미지 상태 영역의 **편집 가능 노드**를 제작하고 Figma 스크린샷으로 확인.

## 2. 원격 초초마이크로 커밋 전략

아래 각 원격 브랜치는 앞선 브랜치의 HEAD에서 새로 만들어졌습니다. Git은 브랜치를 물리적으로 중첩하지 않으므로 **계층적 이름 + 부모 커밋 선형 파생**으로 표현했습니다. 각 파일 변경 단위가 원격 GitHub Commit API를 통하여 저장되어 즉시 푸시됐습니다.

```text
main
 └─ chatgpt-extrahigh/00-foundation
      └─ chatgpt-extrahigh/01-engine/pixel-core
           └─ chatgpt-extrahigh/02-editor/desktop-ui
                └─ chatgpt-extrahigh/03-governance/docs
                     └─ chatgpt-extrahigh/04-reference/paired-photo
```

| 그룹 | 작업 |
|---|---|
| 00 / foundation | Electron 구조, 샌드박스 보안, 파일 열기/저장 IPC, 패키징 구성 |
| 01 / engine | 10개 사진 조절 항목과 7개 프리셋, 이미지 탐색, 테스트 10개 |
| 02 / editor | 한국어 접근성 UI, Figma 팔레트 CSS, 전후 드래그, 확대·슬라이더·픽셀 분석, 실해상도 PNG/JPG 내보내기 |
| 03 / governance | 자체 라이선스, PR·Issue 양식, 협업·행동 강령과 보안 정책 |
| 04 / reference | 동일 장면 원본/완성 사진 픽셀 비교, 수치 최적화, 테스트 5개, 사진·IP·브랜드·테스트·배포 문서 |

모든 소스 커밋 메시지에서 영어 접두사(`feat`, `fix`, `docs` 등)와 한국어 설명을 사용했습니다.

## 3. 구현 알고리즘

1. PNG/JPEG/WebP 파일을 앱으로 안전하게 읽어 들임.
2. 원본 사진을 불변으로 보유하고 최대 1400px 장변의 미리보기에서 새 RGBA 픽셀 버퍼 생성.
3. 노출 → 온도 → 대비 → 채도 → 페이드 → 블룸 → 둥근 픽셀 → 비네팅 → 필름 입자 순으로 적용.
4. 마우스 좌표별 RGB HEX 및 그림자/중간톤/하이라이트 분류.
5. Before/After 비교 핸들과 확대·격자, Undo/Redo 제공.
6. 원하는 결과 이미지가 있다면 참조와 원본 픽셀의 평균 제곱 오차(MSE)를 최소화하도록 6가지 전역 설정값을 근사.
7. 사용자가 저장할 때 원본 사진 해상도로 다시 처리하여 PNG/JPG 내보냄.

**제약:** 비트맵 정합, 객체별 마스크, RAW, ICC/EXIF, 실시간 GPU 필터, 사진 속 장면 식별 AI는 현재 제공하지 않습니다.

## 4. 브랜딩·저작권·기여

- 새 브랜드 커버 SVG와 로고를 직접 제작.
- 앱 예시용 풍경 SVG는 자체 창작물이므로 저작권 분쟁 가능성이 있는 외부 사진 바이너리 포함을 피함.
- 외부 CC0 실사 사진 두 가지의 참조 링크를 `docs/TEST_PLAN.md`에 정리 (라이선스 페이지 참고용).
- `LICENSE`는 PR-SAL-1.0 자체 소스 공개형 라이선스 **초안**. 실무/법적 확정 전 변호사 검토 권장.
- `CONTRIBUTING.md`, `AGENTS.md`, `SECURITY.md`, PR·Issue 템플릿으로 사람과 AI의 책임 및 단위 테스트 원칙을 문서화.

## 5. 현재까지 실제 수행한 검증

| 항목 | 결과 |
|---|---|
| GitHub 원격 커밋 및 즉시 푸시 | 완료 |
| Figma 파일 생성, editable 1440×900 화면, 시각 확인 | 완료 |
| 필터 엔진 JS 단위 테스트 11개 | **11 / 11 통과 (V8 재현 하네스)** |
| 참조 이미지 매칭 JS 단위 테스트 5개 | **5 / 5 통과 (V8 재현 하네스)** |
| JavaScript 소스 문법 컴파일 | 통과 |
| HTML과 JS의 DOM ID 연결/스크립트 로드 순서 검사 | 통과 |
| Electron 샌드박스/프로토콜/IPC 검증 구현 | 코드 확인 |
| Electron 실제 GUI 실행 및 OS 파일 다이얼로그 검증 | **미실행** |
| Node.js 프로젝트에서 npm test 명령 직접 실행 | **미실행** |
| 실제 CC0 원본 사진 바이너리를 이용한 통합 테스트 | **미실행** |
| Windows 포터블/설치 EXE 및 Linux AppImage 빌드 | **미실행** |
| 코드서명·릴리스 체크섬·스토어 배포 | **미실행** |

Electron 바이너리 설치가 불가능한 실행 환경에서 자체 제작된 로직의 단위 검증을 대신 수행했습니다. 위 표는 **실행하지 않은 작업을 완료라고 기록하지 않기 위해** 분리한 것입니다. GUI·패키징 가능 여부는 대상 OS에서 실제로 확인할 필요가 있습니다.

## 6. 추후 QA 및 릴리스 통과 조건

- 대상 Windows 10/11 장치에서 `npm install && npm run verify && npm start` 확인.
- 실제 CC0 또는 본인 촬영 사진의 PNG/JPEG/WebP 열기/저장, EXIF 회전, 투명 PNG 등을 포함한 통합 점검.
- 출력 이미지 해상도/색상 결과 및 alpha 보존 검증.
- 24MP 큰 사진 처리 시 UI 지연/메모리 사용 계측.
- 코드 서명 또는 미서명 릴리스 주의 문구, 파일 체크섬, 릴리스 태그 관리.
- 외부 PR, 기여자 동의와 향후 license governance에 대한 유지관리자 검토.

---

*Made pixel by pixel, recorded commit by commit. ♡*
