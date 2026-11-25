# 공주일기

하루 한 편 짧은 일기를 쓰고, 그날 내 일기를 써야 같은 날 다른 멤버의 일기가 열리는 교환일기 앱(Expo + Supabase).

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
