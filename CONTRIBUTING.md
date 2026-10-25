# 기여하기 🍑

pixel-rounded는 작은 변화가 모여 완성도를 높인다는 원칙을 추구합니다.

## 기여 전 체크

1. [LICENSE](LICENSE)와 [라이선스 안내](docs/LICENSE_GUIDE.md)를 읽으세요. 현재는 OSI 오픈소스가 아닌 소스 공개형 프로젝트입니다.
2. Node.js 22 이상, npm 설치 후 명령 실행: `npm install`, `npm run check`, `npm test`
3. 버그 이슈에는 재현 단계, 예상/실제 결과, OS와 개인정보를 제거한 화면을 작성하세요.
4. 본인에게 권리가 있는 코드·폰트·사진만 제출하세요.

## 브랜치 전략

Git에는 진짜 의미의 *브랜치 안의 브랜치*가 없습니다. 대신 다음 순서로 **기반 HEAD에서 하위 개발 브랜치를 파생**시키고 마지막 통합 브랜치를 PR로 올립니다.

```text
main
  └─ chatgpt-extrahigh/00-foundation
       └─ chatgpt-extrahigh/01-engine/pixel-core
            └─ chatgpt-extrahigh/02-editor/desktop-ui
                 └─ chatgpt-extrahigh/03-governance/docs
                      └─ PR → main
```

- 사람 기여자: `feat/short-name`, `fix/short-name`, `docs/short-name`
- 하위 단계는 이전 단계에서 *파생*할 뿐, Git ref 이름을 디렉터리/파일 충돌 방식으로 중첩하지 않습니다.
- 최종 PR 병합은 일반 merge commit(no-ff 해당) 방식을 우선하여 기록 보존.
- 다른 사람의 브랜치를 강제 푸시하지 않습니다.

## 초초마이크로 커밋

**영어 접두사 + 한국어 메시지**, 완결된 작은 단위마다 **즉시 커밋·푸시**.

예시:
- `feat: 사진의 색온도 조절 알고리즘 구현`
- `fix: 알파 채널 왜곡 및 경계 문제 수정`
- `test: 둥근 픽셀 1px 회귀 테스트 추가`
- `docs: 사진 기법의 수학적 근거 보완`
- `security: IPC 송신자 검증 로직 추가`

접두사: feat, fix, test, docs, refactor, perf, style, security, chore.

## 사람 + AI 검토 기준

- [ ] 원본 이미지 바이트 불변, 처리 결과의 알파 채널 보존
- [ ] 픽셀 좌표와 비교 핸들의 정상 동작
- [ ] PNG/JPG 내보내기 및 키보드 조작 검증
- [ ] 로컬 외부 전송 없음, 경로 검증, IPC 경계 유지
- [ ] 새 필터의 설명과 단위 테스트 추가
- [ ] 제3자 자산의 별도 권리 검증
- [ ] 실행 결과/알려진 한계 문서 작성

AI 리뷰는 **참고 검토**이며 자동 승인, 자동 배포, 머지의 근거가 아닙니다. 현재 GitHub Actions를 사용한 자동 머지 시스템은 설치하지 않았습니다. [AGENTS.md](AGENTS.md)를 함께 읽어주세요.
