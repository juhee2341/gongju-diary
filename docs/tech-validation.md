# 착수 첫 주 기술 검증 결과

기준: [spec.md '착수 첫 주 기술 검증'](spec.md#착수-첫-주-기술-검증) · 작성일 2026-11-25

Supabase dev 프로젝트(`gongju-diary-dev`, 서울)는 만들었고, 실기기·Docker·Android SDK·Xcode가 없는 환경에서 확인할 수 있는 것과 없는 것을 나눠 적었다. "대기" 항목은 아래 '확인 방법'대로 실기기와 Supabase dev 프로젝트에서 확인한 뒤 이 표와 spec.md를 고친다.

| # | 항목 | 상태 | 지금까지 확인한 것 | 남은 확인 방법 |
| --- | --- | --- | --- | --- |
| 1 | 익명 → 구글 linkIdentity, 다른 기기에서 같은 사용자 | 대기 | dev 프로젝트에 익명 로그인·수동 연결 켬(`supabase config push`), 실서버에서 익명 가입 → complete_profile 흐름 확인 | dev 프로젝트에 구글 OAuth 등록 → 기기 A에서 익명 가입 후 `linkIdentity({ provider: 'google' })` → 기기 B에서 구글 로그인 → `auth.uid()`가 같은지 |
| 2 | iOS 애플 로그인으로 익명 계정 연결 | 대기 | 애플 개발자 계정 필요 | `expo-apple-authentication`으로 ID 토큰 받기 → `linkIdentity`가 네이티브 ID 토큰을 받는지 확인. 안 되면 `signInWithIdToken` 후 데이터 이전 방식으로 기획 수정 |
| 3 | Storage 읽기 정책에서 경로의 entry_id로 can_view_entry 호출 | **완료** | 2026-11-25 dev 프로젝트에서 확인. `entry_photo_readable(name)`이 `split_part(name, '/', 2)::uuid`로 entry_id를 꺼내 `can_view_entry`를 호출. 친구 일기 사진의 서명 URL은 내가 그날 쓰기 전에는 거부, 쓰고 나면 발급(`supabase/tests/live` 6단계) | 없음 — spec 변경 불필요 |
| 4 | 재인코딩한 JPEG에 위치 정보가 남지 않는지 | 대기 | `src/lib/image`가 `expo-image-manipulator`로 JPEG 재인코딩하고, picker에 `exif: false` | 위치 정보가 있는 사진을 실기기에서 골라 처리 → 결과 파일을 PC로 옮겨 `exiftool`로 GPS 태그 확인(iOS·안드로이드 각각) |
| 5 | Hermes에서 Intl.Segmenter | 대기(대비 완료) | `src/lib/text`가 `Intl.Segmenter`가 있으면 쓰고, 없으면 자체 분리기로 대체. 대체 분리기는 ZWJ 이모지·피부색·국기·키캡·결합 문자 테스트 통과 | 개발 빌드에서 `hasIntlSegmenter` 값을 출력. false면 대체 분리기를 유지하고, 한계(드문 결합 문자)는 서버 상한으로 방어 |
| 6 | pg_cron 30분 → Edge Function → Expo Push | 대기 | 8단계 범위 | dev 프로젝트에서 `pg_cron` + `pg_net`으로 Edge Function 호출 → 실기기 푸시 수신 |
| 7 | GitHub Actions 핑으로 일시정지 방지 | 진행 중 | `.github/workflows/keepalive.yml`(3일마다 REST 핑). 저장소 Secrets 등록 완료, 2026-11-25 수동 실행 성공 | 7일 넘게 앱 요청 없이 프로젝트가 활성 상태로 남는지 확인(2026-12-02 이후) |

## 기획 반영이 필요할 수 있는 점

- 1·2번 결과에 따라 A3 "이전 계정 불러오기"와 G1 계정 연결 방식이 바뀔 수 있다. 지금은 해당 버튼이 "계정 연결은 준비 중이에요" 토스트만 띄운다.
- 문의 이메일, 약관·개인정보처리방침 주소, 스토어 주소가 정해지지 않아 `src/constants/app.ts`에 빈 값으로 두었다. A1의 "문의하기"·"업데이트하기", A3의 약관 "보기"가 이 값을 쓴다(약관 주소가 비어 있으면 시트 안에 안내 문구 표시).
