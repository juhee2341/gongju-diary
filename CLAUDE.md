# 공주일기

React Native(Expo) 교환일기 앱. 하루 한 편 짧은 일기를 쓰고, 그날 내 일기를 써야 같은 날 다른 멤버의 일기가 열린다.

## 기준 문서

- `docs/spec.md`: 요구사항, 용어, 정책 상수, 열람 규칙, 데이터 구조(RLS·오류 코드·푸시), 기술 스택, 개발 로드맵, 검수 시나리오, 운영 정책
- `docs/screens.md`: 22개 화면(A1~G4)의 진입·배치·상태·동작·엣지 케이스·데이터, 공통 규칙

작업 전에 관련 섹션을 먼저 읽는다. 문서와 코드가 다르면 문서를 따르고, 문서가 모호하거나 서로 충돌하면 추측하지 말고 질문한다.

## 작업 순서

`docs/spec.md`의 '개발 로드맵' 1~11단계 순서대로 진행한다. 첫 작업은 '착수 첫 주 기술 검증' 7개 항목이며, 결과는 문서에 반영할 수 있도록 보고한다. 각 단계가 끝나면 해당하는 '검수 시나리오'(T1~T26)로 확인한다.

## 규칙

- 숫자와 문구를 코드에 직접 쓰지 않는다. 정책 상수는 `src/constants/policy.ts`, 문구와 오류 코드 문구는 `src/copy/ko.ts`에서만 가져온다
- 색은 역할 이름(primary, danger 등)으로만 쓰고 실제 값은 `src/theme/tokens.ts`에 둔다. 디자인이 확정되기 전에는 임시 값을 쓴다
- 날짜 계산은 `src/lib/date`에서만 한다. "오늘"은 사용자 현지 날짜이고 서버는 user_settings.timezone으로 계산한다
- 글자 수는 grapheme 단위로 센다
- 열람 규칙은 반드시 서버(RLS, can_view_entry)에서 강제한다. 앱 쪽 숨김만으로 처리하지 않는다
- DB 변경은 `supabase/migrations`의 마이그레이션 파일로만 한다
- 이슈·커밋·주석에 화면 ID를 붙인다(예: `[C4] 잠긴 카드`)
- 모든 도구와 서비스는 무료 범위 안에서 쓴다(`docs/spec.md` '무료 운영')

## 협업 방식 (혼자라도 팀처럼)

- 로드맵 단계·버그는 GitHub 이슈로 관리한다(라벨: roadmap, server, app, chore, verification, bug, web-only)
- 이슈마다 브랜치를 만든다: `feat/step-3-entries`, `fix/terms-precheck`, `chore/...`
- 커밋 메시지·PR은 한국어, 화면 ID를 붙인다. PR 본문에 `Closes #이슈`
- 머지 전 확인: CI(타입 체크·테스트·번들) 통과, 새 마이그레이션은 dev에 적용 후 `pnpm test:live` 통과
- 단계가 끝나면 README '진행 상황'과 docs/tech-validation.md를 갱신한다
