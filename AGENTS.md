# AGENTS.md — pixel-rounded 협업 규칙

## 제품 경계

pixel-rounded는 **로컬 우선 Electron 사진 편집기**입니다. 원본/참조 사진, 비교 슬라이더, 픽셀 샘플링 및 전후 이미지 기반 색감 추정을 제공합니다.

- 렌더러는 Node.js API를 사용할 수 없습니다.
- 메인 프로세스에서 검증된 IPC만 수행합니다.
- 사용자의 이미지는 절대로 자동 업로드하지 않습니다.
- 제3자 사진을 프로젝트에 포함할 때는 LICENSE/저작권/사용 조건을 확인합니다.
- 테스트를 수행하지 않고 성공했다고 적지 않습니다.
- 자체 PR-SAL-1.0은 OSI 오픈소스가 **아닙니다**.

## 개발 규칙

- Electron 보안 경계: contextIsolation true, nodeIntegration false, sandbox true, URL 전용 프로토콜과 IPC 송신자 검증.
- 비트맵 엔진: 입력 버퍼 불변, RGBA 알파 보존, 수학적 범위 클램핑, 시드 기반 재현성.
- Before/After 룩 추정: 정확한 LUT 복원이 아닌 전역 색감 근사. 다른 장면을 동등하게 취급하지 않습니다.
- HTML 접근성: 한글 레이블, 키보드 버튼, aria-live 상태, 포커스 대비.
- 코드 변경과 동시에 관련 단위 테스트 및 기법 설명을 업데이트합니다.
- 패키지 서명 키, 비밀번호, 실사용 사진을 git에 저장하지 않습니다.

## Git 협업

- AI 브랜치 접두어: `chatgpt-extrahigh/`
- 하위 브랜치는 부모 브랜치 HEAD에서 파생합니다. 예: `00 → 01 → 02 → 03 → 04`.
- 각 원자적 변경: commit 직후 push. 메시지: `feat: 사진 편집기 부드러운 프리뷰 개선`.
- PR 통과 후 일반 merge commit 방식으로 통합하고 중간 SHA를 보존합니다.
- 커밋 수 자체가 아닌 **검증 가능한 작은 변화**를 추구합니다.
- 남의 작업에 강제 푸시하지 않습니다.

## 리뷰 체크

1. **기능** — 원본 손상·전후 비교 방향·내보내기 화질 회귀가 없는가?
2. **성능** — 최대 24MP 제약, 프리뷰 1400px, MSE 최적화의 시간과 메모리 사용을 설명했나?
3. **안전성** — 파일 확장자·매직 바이트·경로·IPC·외부 리소스 안전성이 확보되는가?
4. **UX** — 한글, 키보드, 오류 표시, 반응형 최소 해상도에서 겹침이 없는가?
5. **권리** — 폰트·사진·라이선스·기여자의 저작권을 존중하는가?
6. **검증** — `npm run verify` 결과와 실제 Electron GUI 테스트 결과를 분리해 기록했는가?

## 핵심 소스

- `src/main.js` — secure scheme / native IO
- `src/preload.js` — explicit IPC surface
- `src/renderer/filters.js` — deterministic pixel pipeline
- `src/renderer/matcher.js` — pairwise RGB appearance optimization
- `src/renderer/renderer.js` — UI event/controller
- `docs/PHOTOGRAPHY.md` / `docs/FILTERS.md` — 이론 및 알고리즘

## AI 자동 리뷰 정책

AI는 diff 리뷰와 반례·취약점·테스트 제안을 수행할 수 있으나 **자동 승인·자동 머지는 구성되어 있지 않습니다**. 사람 리뷰 승인 없는 프로덕션 배포 금지. 위험한 변경은 별도 인간 검토를 받습니다.
