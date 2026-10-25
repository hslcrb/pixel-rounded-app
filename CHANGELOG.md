# Changelog

## 0.1.0 — 2026-10-26 (source-stage)

### Added
- pixel-rounded 브랜드 아이덴티티와 Figma 1440×900 데스크톱 시안
- Electron 보안 프리로드/로컬 이미지 open-save IPC/전용 origin
- 7가지 사진 필터 프리셋, 10개 기본/실험적 파라미터
- 드래그 가능한 Before/After, 확대, 픽셀 HEX·톤 분류, Undo/Redo
- 두 장의 같은 장면 사진으로 RGB 픽셀 손실을 줄이는 전역 필터 추정
- PNG/JPG 원본 해상도 내보내기
- 프로젝트 고유 소스 공개 라이선스, 브랜드/필터/사진/테스트 문서
- 단위 테스트(필터 10개, 매칭 5개)

### Verified
- V8 별도 테스트 하네스에서 15개 테스트 통과
- JavaScript 문법 및 참조 DOM ID 확인
- Figma 시안 생성과 시각적 스크린샷 확인

### Pending
- npm 종속성 설치 후 실제 Node.js 테스트 명령 실행
- Electron GUI 수동 점검 및 바이너리 빌드
- 실제 CC0 사진 포맷별 통합 테스트 및 서명 릴리스
