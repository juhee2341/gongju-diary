# 공주일기 👑

> **내가 써야, 친구의 오늘이 열린다.**
> 하루 한 편 짧은 일기를 쓰고, 그날 내 일기를 써야 같은 날 친구들의 일기가 열리는 교환일기 앱 (Expo + Supabase)

## 왜 다시 만들었나

### 1. 먼저 웹으로 만들었다 — [daily-log](https://github.com/juhee2341/daily-log)

시작은 **daily-log**였다. 설치도 가입도 없이 카톡 링크 하나로 들어와서, 친구들과 매시간 사진 한 장씩을 함께 남기는 웹 서비스다. 진입 장벽을 0에 가깝게 낮추는 게 목표였고, 실제로 링크만 보내면 누구나 바로 쓸 수 있었다.

### 2. 직접 써 보니 불편했다

만든 사람이 가장 먼저 쓰는 사람이 된다. 매일 쓰다 보니 바로 느껴졌다.

- **매일 들어가야 하는 서비스인데, 매일 찾아 들어가야 했다.** 링크를 찾고, 브라우저를 열고, 다시 들어가는 과정이 하루하루 쌓이니 생각보다 무거웠다.
- **웹은 나를 불러 주지 않는다.** 앱처럼 "오늘 아직 안 썼어요"라고 먼저 말을 걸어 주지 않으니, 바쁜 날엔 그냥 잊혔다.
- **습관이 되려면 홈 화면에 있어야 한다.** 매일 하는 일일수록 아이콘 한 번 누르면 바로 열려야 했다.

"설치 없이 쉽게"는 처음 한 번을 쉽게 만들어 주지만, **매일 돌아오게 만들지는 못한다**는 걸 직접 써 보고 알게 됐다.

### 3. 그래서 친구들과 매일 쓸 앱을 만든다

공주일기는 그 깨달음에서 출발한다. 남에게 보여 주려고 만드는 게 아니라, **내가 친구들과 실제로 매일 쓰려고** 만드는 앱이다.

| | daily-log (웹) | 공주일기 (앱) |
| --- | --- | --- |
| 리듬 | 매시간 사진 한 장 | **하루 한 편**, 부담 없는 짧은 일기 |
| 돌아오는 이유 | 내가 기억해서 들어가야 함 | **저녁 리마인드 푸시**, 친구가 쓰면 알림 |
| 함께 쓰는 동기 | 같이 찍는 재미 | **내가 써야 친구 일기가 열린다** |
| 보관 | 오늘과 어제만 | 주·월·년으로 쌓이는 **나만의 기록과 감정 달력** |
| 혼자일 때 | — | 혼자 쓰기 일기장도 지원 |

daily-log에서 잘 된 것은 그대로 가져왔다. **가입 없이 익명으로 바로 시작**하고, **초대 링크 → 방장 승인**으로 들어오며, 열람 규칙은 화면이 아니라 **서버(RLS)에서 강제**한다. 웹에서 부족했던 **"매일 돌아오게 하는 힘"**은 앱으로 채운다.

---

- 기획: [docs/spec.md](docs/spec.md), 화면: [docs/screens.md](docs/screens.md)
- 기술 검증 진행 상황: [docs/tech-validation.md](docs/tech-validation.md)
- 작업 규칙: [CLAUDE.md](CLAUDE.md)

## 시작하기

```bash
pnpm install
cp .env.example .env   # Supabase dev 프로젝트 URL과 publishable key 입력
```

### Supabase

dev 프로젝트: `gongju-diary-dev` (ref `qrsdvvjdnvexfyanfthq`, 서울). 새로 연결할 때:

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref <dev-project-ref>
pnpm exec supabase db push        # supabase/migrations 적용
```

대시보드 Authentication에서 **Anonymous sign-ins**와 **Manual linking**을 켠다(로컬 설정은 `supabase/config.jsonc`에 반영됨).

### 미리보기 (빌드 도구 없이)

```bash
pnpm web       # 브라우저에서 보기 (http://localhost:8081). 사진 선택·공유·확인창은 웹에서 다르게 동작
pnpm go        # 휴대폰 Expo Go 앱으로 QR 스캔 (같은 와이파이, 안 되면 --tunnel)
```

### 앱 실행

애플 로그인 등 네이티브 모듈 때문에 Expo Go 대신 개발 빌드를 쓴다.

```bash
pnpm android   # expo run:android (Android Studio 필요)
pnpm ios       # expo run:ios (Xcode 필요)
pnpm start     # 개발 빌드가 설치된 뒤 dev server만 실행
```

## 검사

```bash
pnpm typecheck
pnpm test      # 날짜·글자 수 단위 테스트 + 마이그레이션/RLS 테스트(PGlite, Docker 불필요)
```

`supabase/tests/db.test.ts`는 PGlite에 Supabase의 auth·storage를 최소한으로 흉내 내어 마이그레이션과 RLS를 확인한다. Storage API처럼 흉내 낼 수 없는 부분은 dev 프로젝트에서 따로 확인한다.

## 폴더 구조

```
app/                 화면(Expo Router) — index(A1), onboarding(A3), profile/new(A4), diary/new(B2),
                     (tabs)/home(B1)·home/diary/[id](C1)·home/diary/[id]/settings(E1), notifications, settings
src/features/        기능별 로직 (auth, profile, …)
src/lib/             supabase, query, date, text, image, device
src/constants/       policy.ts(정책 상수), emotions, reactions, prompts, avatars, app
src/copy/ko.ts       모든 문구와 오류 코드 문구
src/theme/           tokens.ts(라이트·다크 역할 색), ThemeProvider
supabase/            migrations/, tests/, config.jsonc
```

## 진행 상황 (개발 로드맵)

- [x] 1단계 기반 — Expo 프로젝트, Supabase 연결, 익명 로그인, 테마 토큰, A1·A3·A4 (기술 검증은 [진행 중](docs/tech-validation.md))
- [x] 2단계 일기장 — B1 홈 카드·고정·검색, B2 만들기·초대 공유, E1 이름·커버·늦게 쓰기 기간·초대 코드 재발급·함께 쓰기 전환·알림 끄기
  - 일기 집계(오늘 작성 리본, 오늘 N명, 최근 감정)는 3단계, 참여 요청·멤버 관리는 5단계, 나가기는 9단계에서 연결
- [ ] 3단계 일기 작성 (D1, D2)
- [ ] 4~11단계
