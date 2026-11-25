# 공주일기 기획서

기준일: 2026-11-25 · 화면별 상세는 [screens.md](screens.md)

## 요구사항

공주일기는 혼자 또는 최대 10명이 하루 한 편씩 짧은 일기를 쓰고, 그날 내 일기를 써야 같은 날 다른 멤버의 일기가 열리는 React Native(Expo) 교환일기 앱이다. 이 문서와 화면 기획 문서(screens.md)의 모든 수치·용어·문구는 이 섹션의 정의를 따른다.

### 용어

| 용어 | 정의 |
| --- | --- |
| 공주 | 앱 사용자를 부르는 호칭. 문구에서 특정인은 "{닉네임}님", 불특정 다수는 "공주들"로 쓴다 |
| 일기장 | 일기를 모으는 단위. 혼자 쓰기(1인) 또는 함께 쓰기(2\~10명) |
| 주인 / 멤버 | 일기장을 만든 사람(또는 위임받은 사람) 1명 / 주인을 포함한 일기장 참여자 전원 |
| 오늘 | 해당 사용자 기기의 현지 날짜. 작성은 작성자 기준, 열람 판정은 열람자 기준 |
| 참여일 | 멤버가 승인된 시점의 그 멤버 현지 날짜. 주인은 일기장 생성일 |
| 작성 가능 날짜 | 참여일과 (오늘 − LATE\_WINDOW) 중 늦은 날부터 오늘까지. 이미 일기가 있는 날짜는 제외 |
| 늦은 일기 | 작성 시점의 오늘이 아닌 날짜로 저장된 일기 |
| 열림 | 열람자가 그 날짜에 일기를 저장해 생긴 상태. 한 번 생기면 일기를 지워도 유지 |
| 자동 공개 | 날짜가 (오늘 − LATE\_WINDOW)보다 이전이 되어 작성 여부와 관계없이 열리는 상태 |
| 잠김 | 열림도 자동 공개도 아닌 다른 멤버의 일기 |
| 떠난 공주 | 탈퇴·내보내기·계정 삭제로 사라진 사용자의 표시 이름 |

### 정책 상수

| 상수 | 값 | 사용 화면 |
| --- | --- | --- |
| MAX\_MEMBERS | 10명 (주인 포함) | B3, E2 |
| NICKNAME\_LEN | 1\~10자 | A4, G1 |
| DIARY\_NAME\_LEN | 1\~20자 | B2, E1 |
| ENTRY\_MAX\_CHARS | 300자 | D1 |
| COMMENT\_MAX\_CHARS | 100자 | D2 |
| MAX\_PHOTOS | 3장 | D1 |
| PHOTO\_SIZE | 긴 변 1080px, JPEG 품질 0.7, 목표 200KB, EXIF(위치 정보 포함) 제거 | D1 |
| THUMB\_SIZE | 긴 변 400px, 정사각 중앙 크롭 | C4, D1 |
| AVATAR\_SIZE | 512×512px | A4, G1 |
| LATE\_WINDOW | 함께 쓰기: 1·3·7일 중 선택(기본 3일) / 혼자 쓰기: 7일 고정 | B2, E1, C1, C4, D1 |
| INVITE\_CODE | 6자리, A\~Z·2\~9 중 O·I 제외 | B2, B3, E1 |
| CODE\_FAIL\_LIMIT | 10회 실패 시 60초 대기 | B3 |
| REQUEST\_EXPIRE | 대기 요청 30일 후 만료 | B4, E2 |
| REJECT\_COOLDOWN | 거절 후 24시간 동안 재요청 불가 | B3 |
| REJECT\_DISPLAY | 거절된 요청은 B4에 7일 표시 | B4 |
| PIN\_LEN | 숫자 4자리 | A2, G2 |
| PIN\_FAIL\_LIMIT | 5회 실패마다 대기, 30초에서 시작해 2배씩, 최대 10분 | A2 |
| LOCK\_DELAY | 즉시 / 1분 / 5분 (기본 즉시) | G2 |
| DRAFT\_INTERVAL | 5초마다 기기에 임시저장 | D1 |
| COMMENT\_PAGE | 20개씩 불러오기 | D2 |
| NOTI\_RETENTION | 알림 30일 보관 | F1 |
| REMINDER\_DEFAULT | 21:00 | G3 |
| ORPHAN\_CLEANUP | 일기와 연결 안 된 사진 24시간 뒤 삭제 | 서버 |
| KEEPALIVE | 3일마다 서버 핑 | 서버 |
| REQUEST\_TIMEOUT | 10초 | 공통 |
| LINK\_NUDGE | 미연결 + 일기 3편 이상이면 표시, 닫으면 30일 숨김 | B1 |
| NOTI\_PAGE | 30개씩 불러오기 | F1 |
| COVER\_COLORS | 8종, 키는 cover\_1\~cover\_8(기본 cover\_1), 색 값은 디자인 단계에서 정함 | B2, E1 |
| AVATAR\_EMOJIS | 공주 테마 24종, 기본 👑 | A4 |
| ENTRY\_MIN\_CHARS | 사진이 없을 때 본문 5자 이상 | D1 |
| COMMENT\_RATE | 같은 사람 5초에 댓글 1개 | D2 |
| DAILY\_PROMPTS | 오늘의 질문 30개, 날짜별 순환 | D1 |
| MIN\_AGE | 만 14세 이상 | A3 |
| OWNER\_INACTIVE | 주인이 60일 넘게 접속 안 함 | E1 |
| OWNER\_CLAIM\_WAIT | 주인 맡기 요청 후 7일 안에 거절 없으면 위임 | E1 |
| ANON\_PURGE | 프로필 없는 익명 계정 7일 후 삭제 | 서버 |

### 기능 요구사항

| 영역 | 요구사항 |
| --- | --- |
| 인증 | 첫 실행 시 익명 계정 자동 생성. 구글/애플(안드로이드는 구글만) 계정 연결은 선택이며 연결하면 기기 변경·재설치 후 복구 가능 |
| 프로필 | 닉네임(NICKNAME\_LEN) + 아바타(이모지 또는 사진). 앱 전체에서 하나, 중복 허용 |
| 일기장 | 혼자 쓰기 / 함께 쓰기. 이름(DIARY\_NAME\_LEN), 커버 색상 8종. 한 사람이 일기장 수 제한 없이 참여. 혼자 쓰기 → 함께 쓰기 전환만 가능. 가입 시 혼자 쓰기 일기장 "나의 공주일기" 자동 생성. 작성 모드 필드는 free 고정(차례형은 v2) |
| 참여 | 초대 코드 또는 공유 링크 → 참여 요청 → 주인 승인/거절. 주인은 코드 재발급 가능 |
| 나가기 | 멤버: 내 일기·댓글·리액션·열림 기록 삭제 후 탈퇴. 주인: 위임 후 탈퇴 또는 일기장 삭제. 주인은 멤버 내보내기 가능(탈퇴와 같은 삭제). 주인이 OWNER\_INACTIVE 넘게 미접속이면 멤버가 주인 맡기 요청 가능 |
| 일기 | 일기장마다 사람당 날짜당 1편. 감정 1개 필수 + 사진(MAX\_PHOTOS) 1장 이상 또는 본문 ENTRY\_MIN\_CHARS\~ENTRY\_MAX\_CHARS. 수정·삭제 시간 제한 없음, 삭제 후 같은 날짜 재작성 가능, 수정 시 "수정됨" 표시 |
| 열람 | 아래 열람 규칙을 서버(RLS)에서 강제. 잠긴 일기는 작성자 닉네임과 작성 여부만 노출 |
| 반응 | 댓글(COMMENT\_MAX\_CHARS, 대댓글·수정 없음, 댓글 작성자 또는 일기 작성자가 삭제), 리액션 6종 중 1인 1개(교체·취소 가능) |
| 알림 | 아래 알림 종류 표의 이벤트. 종류별·일기장별로 끌 수 있음. 저녁 리마인드 1일 1회 |
| 보관 | 주 / 월 / 년 보기, 날짜별 모아보기 |
| 앱 잠금 | PIN\_LEN 숫자, 기본 꺼짐, LOCK\_DELAY 선택, 최근 앱 화면 가리기. PIN은 기기에만 해시 저장 |
| 잠금 분실 | 계정 연결 사용자: 재인증으로 초기화. 미연결 사용자: 복구 불가(잠금 켤 때 경고) |
| 신고·차단 | 일기·댓글·사용자 신고, 사용자 차단(서로의 일기·댓글·알림 숨김). 스토어 심사 필수 |
| 계정 삭제 | 앱 안에서 즉시 삭제. 주인인 일기장은 위임 또는 삭제를 먼저 선택 |
| 정책 문서 | 첫 실행 시 이용약관·개인정보 수집 동의와 만 14세 이상 확인(A3), 약관 개정 시 재동의. G1에서 언제든 다시 보기 |

### 열람 규칙

열람자 V가 일기장 X의 날짜 D 일기 E를 볼 수 있는 조건은 1\~4 중 하나가 참이면서 5를 만족할 때다. 사진 파일 접근도 같은 조건을 따른다.

1. E의 작성자가 V다
2. V에게 (X, D) 열림 기록이 있다
3. D < V의 오늘 − LATE\_WINDOW (자동 공개)
4. D < V의 참여일 (참여 전 기록은 바로 공개)
5. V와 E의 작성자 사이에 차단 관계가 없다

LATE\_WINDOW를 늘릴 때는 이미 자동 공개였던 날짜가 다시 잠기지 않도록, 그 날짜들에 대해 멤버 전원의 열림 기록을 만든다(E1).

신고한 일기·댓글은 신고한 사람에게만 열람 규칙과 관계없이 숨긴다(D2).

### 감정 10종

| 키 | 라벨 | 아이콘 |
| --- | --- | --- |
| happy | 행복해 | 웃는 왕관 |
| excited | 설레 | 하트 눈 |
| proud | 뿌듯해 | 리본 트로피 |
| love | 사랑스러워 | 하트 |
| calm | 평온해 | 찻잔 |
| soso | 그저 그래 | 구름 |
| tired | 피곤해 | 졸린 달 |
| sad | 슬퍼 | 눈물 방울 |
| angry | 화나 | 불꽃 |
| worried | 걱정돼 | 엉킨 실타래 |

감정마다 고유 색을 하나씩 둔다(연간 보기 점, 월간 요약 막대). 값은 디자인 단계에서 정한다.

### 리액션 6종

| 키 | 라벨 | 아이콘 |
| --- | --- | --- |
| heart | 좋아 | 하트 |
| crown | 최고야 | 왕관 |
| laugh | 웃겨 | 웃는 얼굴 |
| hug | 토닥토닥 | 포옹 |
| wow | 놀라워 | 별 눈 |
| sparkle | 공감해 | 반짝이 |

### 오늘의 질문 30개

그해 1월 1일부터 센 날짜 순번을 30으로 나눈 나머지 번호를 그날의 질문으로 쓰고, 새로고침하면 다음 번호로 넘어간다.

1. 오늘 가장 웃겼던 순간은?
2. 오늘의 나를 칭찬해 준다면?
3. 오늘 먹은 것 중 최고는?
4. 오늘 고마웠던 사람은?
5. 오늘 하늘은 어땠어요?
6. 지금 제일 하고 싶은 건?
7. 오늘 새로 알게 된 것은?
8. 오늘 나를 힘들게 한 건?
9. 오늘의 배경 음악을 고른다면?
10. 오늘 가장 설렌 순간은?
11. 오늘 입은 옷 중 마음에 든 것은?
12. 오늘 아쉬웠던 한 가지는?
13. 내일의 나에게 한마디
14. 오늘 들은 말 중 기억에 남는 말은?
15. 오늘 나를 위한 작은 선물은?
16. 오늘 가장 오래 머문 곳은?
17. 오늘 사진으로 남기고 싶은 장면은?
18. 오늘의 나를 동물로 표현하면?
19. 요즘 빠져 있는 것은?
20. 오늘 참았던 말이 있다면?
21. 오늘 잘한 선택 하나는?
22. 오늘 기분을 날씨로 표현하면?
23. 오늘 누군가에게 하고 싶은 말은?
24. 오늘 가장 편안했던 순간은?
25. 이번 주에 기대되는 일은?
26. 오늘 공주처럼 느껴진 순간은?
27. 오늘 처음 해 본 것은?
28. 오늘 나를 웃게 한 사람은?
29. 오늘 내려놓고 싶은 생각 하나는?
30. 오늘 하루에 제목을 붙인다면?

### 아바타 이모지 24종

👑 👸 🦄 🌸 🎀 💖 🍓 🧁 🌙 ⭐ 🌈 🦋 🐰 🐱 🐻 🍑 🌷 🫧 💎 🪄 🏰 🍰 🩰 🐣 (기본 👑, 탈퇴한 사용자는 흐린 👑)

### 알림 종류

| 타입 | 받는 사람 | 푸시 | 문구 | 탭하면 | 끄는 스위치 |
| --- | --- | --- | --- | --- | --- |
| entry\_created | 같은 일기장의 다른 멤버 | O | {닉네임}님이 {M월 D일} 일기를 썼어요 · {일기장} | 열람 가능하면 D2, 아니면 C4 | 새 일기 |
| comment\_created | 일기 작성자 + 그 일기에 댓글 단 멤버(본인 제외) | O | {닉네임}님이 댓글을 남겼어요: {댓글 앞 20자} | D2 | 댓글 |
| reaction\_created | 일기 작성자(본인 반응 제외) | O | {닉네임}님(외 N명)이 일기에 반응했어요 | D2 | 리액션 |
| join\_requested | 주인 | O | {닉네임}님이 {일기장}에 들어오고 싶어 해요 | E2 | 참여·멤버 |
| join\_approved | 요청자 | O | {일기장}에 들어왔어요! | C1 | 참여·멤버 |
| join\_rejected | 요청자 | O | {일기장} 참여 요청이 거절되었어요 | B4 | 참여·멤버 |
| member\_joined | 기존 멤버 | X | {닉네임}님이 새로 들어왔어요 · {일기장} | E2 | - |
| member\_left | 남은 멤버 | X | {닉네임}님이 떠났어요 · {일기장} | C1 | - |
| member\_removed | 내보내진 사람 | O | {일기장}에서 나가게 되었어요 | B1 | 참여·멤버 |
| owner\_transferred | 새 주인 | O | {일기장}의 주인이 되었어요 | E1 | 참여·멤버 |
| diary\_deleted | 주인을 뺀 모든 멤버 | O | {일기장}이 삭제되었어요 | B1 | 참여·멤버 |
| reminder | 오늘 안 쓴 함께 쓰기 일기장이 있는 사람 | O(알림 목록엔 저장 안 함) | 오늘 {N}명이 일기를 썼어요. 내 일기를 쓰면 열려요 (아무도 안 썼으면 "오늘 하루는 어땠어요?") | B1 | 저녁 리마인드 |
| owner\_claim\_requested | 주인 | O | {닉네임}님이 {일기장} 주인을 맡고 싶어 해요. 7일 안에 거절하지 않으면 넘어가요 | E1 | 끌 수 없음 |
| owner\_claim\_rejected | 요청한 멤버 | O | {일기장} 주인이 계속 맡기로 했어요 | E1 | 참여·멤버 |

공통 조건: 차단 관계인 사람의 행동으로는 알림을 만들지 않는다. 일기장별 알림 끄기(E1)는 푸시만 막고 알림 목록에는 남긴다. 잠금 켜짐 상태의 푸시 미리보기는 "새 소식이 있어요"로 대체한다.

## 비슷한 앱 비교

"내가 써야 열린다"는 구조는 BeReal과 같고, 소수 정예 공유는 Locket, 감정 기록과 통계는 Daylio, 교환일기 형식은 국내 앱 하루하루·다이어링과 겹친다. 각 앱에서 가져올 것과 피할 것을 정리했다.

| 앱 | 핵심 방식 | 가져올 것 | 피할 것 |
| --- | --- | --- | --- |
| BeReal | 하루 1회 알림, 내가 올려야 친구 게시물이 보임, 늦게 올리면 늦었다고 표시 | 공개 규칙, 늦은 작성 허용 | 늦은 게시를 친구에게 따로 알려 사용자들이 "부끄러운 표시"로 느낌 → 늦은 일기는 작은 배지만, 별도 알림 없음 |
| Locket | 홈 화면 위젯으로 친한 친구 사진 공유, 친구 20명 제한 | 소수 인원 제한(우리는 10명), 위젯은 v2 | 인원 제한 불만이 많음 → 일기장을 여러 개 만들 수 있으니 일기장당 10명 유지 |
| Daylio | 두 번 탭으로 감정 기록, 연간 감정 색 달력, 연속 기록, PIN 잠금 | 감정 색 연간 보기, 최장 연속 표시, 빠진 날 채우기 | PIN 잠금을 유료로 막아 불만 → 우리는 무료 |
| 하루하루 | 감성 일기 + 커플 공유, 지난 날짜 작성, 매일 추천 질문, 스티커 | 오늘의 질문 | 기능 과다(디데이, 버킷리스트) → 일기에 집중 |
| 다이어링 | 친구·연인·가족과 쓰는 교환일기, 글·사진·스티커, 일기장 커버 | 일기장 커버 색 8종(v1), 커버 꾸미기(v2) | 차별점이 약함 → "써야 열린다" 규칙과 공주 테마로 구분 |

출처: [BeReal 작동 방식](https://www.lilachbullock.com/?p=193131), [BeReal 늦은 게시 체험기](https://career.thelorry.com/?p=13104), [Locket 앱스토어](https://apps.apple.com/us/app/1600525061), [Daylio 기능](https://mindwobble.pages.dev/software/daylio/), [Daylio PIN 유료 리뷰](https://apps.apple.com/za/app/id1194023242?l=en-gb), [하루하루](https://apps.apple.com/kr/app/%ED%95%98%EB%A3%A8%ED%95%98%EB%A3%A8-%EA%B0%90%EC%84%B1-%EC%9D%BC%EA%B8%B0-%EC%BB%A4%ED%94%8C-%EB%8B%A4%EC%9D%B4%EC%96%B4%EB%A6%AC/id6738712179?l=ko), [다이어링](https://apps.apple.com/kr/app/%EB%8B%A4%EC%9D%B4%EC%96%B4%EB%A7%81-%EA%B5%90%ED%99%98%EC%9D%BC%EA%B8%B0-%EC%9D%BC%EC%83%81%EA%B3%B5%EC%9C%A0-%EB%8B%A4%EC%9D%B4%EC%96%B4%EB%A6%AC/id6747893877)

### 이번 검토에서 고친 것

| 문제 | 수정 |
| --- | --- |
| 한 글자만 쓰고 친구 일기를 여는 꼼수 | 사진 없으면 본문 5자 이상(ENTRY\_MIN\_CHARS) |
| 첫 화면이 빈 목록이라 바로 쓸 수 없음 | 가입 시 "나의 공주일기" 자동 생성 |
| 온보딩에서 알림 권한을 너무 일찍 요청 | 함께 쓰기 일기장에 처음 참여·작성할 때 안내 후 요청 |
| 약관 동의, 연령 확인 누락 | A3에 동의 단계와 만 14세 이상 확인 추가 |
| 사진 위치 정보 노출 위험 | 업로드 전 EXIF 제거 |
| 신고 후에도 그 글이 계속 보임 | 신고자에게 즉시 숨김 |
| 댓글 도배 | COMMENT\_RATE 제한 |
| 같은 날 일기를 볼 때 매번 뒤로 나가야 함 | D2에서 좌우로 넘겨 같은 날 다른 일기 보기 |
| 연간 보기가 작성 여부만 보여 밋밋함 | 감정 색 점 + 최장 연속 기록 |
| 빈 입력창 앞에서 막막함 | 오늘의 질문을 입력창 안내 문구로 |
| 다크 모드 선택 불가 | G1에 화면 모드 추가 |

## 디자인 방향

색상, 글꼴, 아이콘 모양은 디자인 단계에서 정한다. 기획서는 색의 역할 이름만 쓰며, 화면 기획의 primary·danger 같은 이름은 아래 역할을 가리킨다.

| 역할 | 쓰임 |
| --- | --- |
| primary | 주요 버튼, 선택 상태, 오늘 표시 |
| primarySoft | 선택된 칩·날짜 배경, 안 읽은 알림, 안내 카드 배경 |
| background | 화면 배경 |
| surface | 카드, 일기 종이 |
| text / textSub | 본문 / 날짜·보조 문구 |
| accent | 리액션, 늦은 일기 배지 |
| locked | 잠긴 일기 카드 |
| danger | 삭제·나가기 버튼, 오류 문구 |

- 모든 역할에 라이트·다크 두 값을 둔다
- 감정 10종과 일기장 커버 8종에도 각각 고유 색이 필요하다
- 모서리는 크게 둥글게(카드 16, 버튼 24)
- 잠긴 일기는 흐림 처리 + 자물쇠 + "내 일기 쓰면 열려요"
- 감정·리액션·아바타 아이콘은 하나의 공주 테마 세트로 통일
- 제목용과 본문용 글꼴을 구분하되 본문은 가독성 우선

## 화면 목록

화면은 총 22개이고, 하단 탭은 홈·알림·설정 3개로 둔다.

| ID | 화면 | 주요 기능 |
| --- | --- | --- |
| A1 | 스플래시 | 익명 로그인 자동 처리, 잠금 여부 확인 |
| A2 | 잠금 화면 | 4자리 PIN 입력, 실패 횟수 제한, 잊어버렸어요(계정 재인증) |
| A3 | 온보딩 | 앱 소개 3장, 약관 동의·만 14세 확인 |
| A4 | 프로필 만들기 | 닉네임, 프로필 사진/이모지 선택, 완료 시 "나의 공주일기" 자동 생성 |
| B1 | 홈 (내 일기장 목록) | 참여 중인 일기장 카드, 오늘 작성 여부 표시, 일기장 만들기·참여하기 버튼 |
| B2 | 일기장 만들기 | 이름, 커버 색상, 혼자/함께 쓰기, 늦게 쓰기 기간 |
| B3 | 초대 코드로 참여 | 코드 입력 → 일기장 미리보기 → 참여 요청 |
| B4 | 참여 대기 | 요청 보낸 일기장 목록, 요청 취소 |
| C1 | 일기장 메인 (주간) | 이번 주 7일 × 멤버 그리드, 작성/잠김/미작성 상태, 오늘 쓰기 버튼 |
| C2 | 월간 캘린더 | 날짜별 감정 아이콘, 날짜 탭 → 그날 일기 |
| C3 | 연간 보기 | 12개월 미니 캘린더, 월 탭 → C2 |
| C4 | 하루 일기 모아보기 | 그날 멤버별 일기 카드, 잠김 카드에 "내 일기 쓰면 열려요" |
| D1 | 일기 작성/수정 | 날짜(늦은 작성 가능 범위만), 감정 선택, 사진 3장, 300자 입력, 임시저장 |
| D2 | 일기 상세 | 사진 슬라이드, 본문, 감정, 리액션, 댓글 목록·입력, 신고·차단 메뉴 |
| E1 | 일기장 설정 | 이름·커버 수정, 늦게 쓰기 기간, 초대 코드 보기·재발급, 주인 맡기 요청 |
| E2 | 멤버 관리 | 멤버 목록, 참여 요청 승인/거절, 내보내기 |
| E3 | 일기장 나가기 | 멤버: 삭제 범위 안내 후 탈퇴. 주인: 위임할 멤버 선택 또는 일기장 삭제 |
| F1 | 알림 | 새 일기, 댓글, 리액션, 참여 요청/승인 목록 |
| G1 | 설정 | 프로필 수정, 계정 연결, 주 시작 요일, 화면 모드, 앱 잠금·알림 설정 진입 |
| G2 | 앱 잠금 설정 | 켜기/끄기, PIN 변경, 잠금 시점, 미연결 사용자 경고 |
| G3 | 알림 설정 | 종류별 켜기/끄기, 저녁 리마인드 시간 |
| G4 | 차단 목록 / 계정 삭제 | 차단 해제, 계정 삭제(전체 데이터 삭제 안내) |

주요 흐름은 B1 홈 → C1 일기장 → D1 작성 → C4 그날 일기 열림 → D2 상세에서 댓글·리액션 순서다. 푸시 알림 탭은 D2 또는 E2로 바로 이동한다.

화면별 배치와 엣지 케이스: [screens.md](screens.md)

## 데이터 구조

백엔드는 Supabase(Postgres + 익명 로그인 + Storage + RLS)를 기준으로 테이블 15개와 Storage 버킷 2개로 설계한다. 시각은 모두 timestamptz(UTC), 날짜 의미가 있는 값은 사용자 현지 기준 date로 저장한다. 멤버십과 "내가 써야 열림" 규칙이 관계형 쿼리와 RLS로 깔끔하게 표현되기 때문이다.

### profiles

| 컬럼 | 타입 | 제약·기본값 | 설명 |
| --- | --- | --- | --- |
| id | uuid | PK, auth.users.id 참조 | 사용자 ID |
| nickname | text | 1\~10자(앱에서 문자 단위 검증) | 닉네임 |
| avatar\_type | text | 'emoji' / 'photo', 기본 'emoji' | 아바타 종류 |
| avatar\_emoji | text | 기본 '👑' | 이모지 아바타 |
| avatar\_path | text | null 허용 | 사진 아바타 경로 |
| week\_start | smallint | 1(월) / 0(일), 기본 1 | 주 시작 요일 |
| created\_at, updated\_at | timestamptz | 기본 now() |  |
| terms\_version, terms\_agreed\_at | text, timestamptz | not null | 동의한 약관 버전·시각(만 14세 확인 포함) |
| status | text | 'active' / 'suspended', 기본 'active' | 신고 처리로 이용 제한 |
| last\_seen\_at | timestamptz | 앱 실행·포그라운드 복귀 시 갱신(하루 1회까지) | 주인 장기 미접속 판정 |

### diaries

| 컬럼 | 타입 | 제약·기본값 | 설명 |
| --- | --- | --- | --- |
| id | uuid | PK |  |
| name | text | 1\~20자 | 일기장 이름 |
| cover\_color | text | 팔레트 키 8종 중 하나 | 커버 색상 |
| owner\_id | uuid | FK profiles | 주인 |
| is\_shared | boolean |  | 함께 쓰기 여부 |
| write\_mode | text | 기본 'free' | v2 차례형 대비 |
| late\_window\_days | smallint | 1/3/7, 혼자 쓰기는 7 고정 | LATE\_WINDOW |
| invite\_code | char(6) | unique, 혼자 쓰기는 null | 초대 코드 |
| max\_members | smallint | 기본 10 | MAX\_MEMBERS |
| created\_date | date | 주인 현지 날짜 | 이 날짜 이전으로 이동 불가 |
| last\_activity\_at | timestamptz | 일기·댓글 생성 시 갱신 | 홈 정렬 |
| created\_at, updated\_at | timestamptz |  |  |

### diary\_members

| 컬럼 | 타입 | 제약·기본값 | 설명 |
| --- | --- | --- | --- |
| diary\_id | uuid | PK, FK diaries on delete cascade |  |
| user\_id | uuid | PK, FK profiles |  |
| role | text | 'owner' / 'member' | 일기장당 owner 정확히 1명 |
| joined\_at | timestamptz |  | 승인 시각 |
| joined\_date | date | 멤버 현지 날짜 | 참여일 |
| muted | boolean | 기본 false | 이 일기장 푸시 끄기 |
| pinned | boolean | 기본 false | 홈 상단 고정 |

### member\_history

| 컬럼 | 타입 | 제약·기본값 | 설명 |
| --- | --- | --- | --- |
| diary\_id, user\_id | uuid |  |  |
| reason | text | 'left' / 'removed' | 탈퇴 / 내보내짐 |
| created\_at | timestamptz |  | E2의 "이전에 내보낸 멤버" 표시용 |

### join\_requests

| 컬럼 | 타입 | 제약·기본값 | 설명 |
| --- | --- | --- | --- |
| id | uuid | PK |  |
| diary\_id, user\_id | uuid | (diary\_id, user\_id) 대기 상태는 1건만(부분 unique) |  |
| status | text | pending / approved / rejected / cancelled / expired |  |
| created\_at | timestamptz |  | REQUEST\_EXPIRE 기준 |
| decided\_at | timestamptz | null 허용 | REJECT\_COOLDOWN, REJECT\_DISPLAY 기준 |

### entries

| 컬럼 | 타입 | 제약·기본값 | 설명 |
| --- | --- | --- | --- |
| id | uuid | PK, 앱에서 생성 | 사진 경로에 쓰려고 저장 전에 만든다 |
| diary\_id | uuid | FK diaries on delete cascade |  |
| author\_id | uuid | FK profiles |  |
| entry\_date | date | unique(diary\_id, author\_id, entry\_date) | 일기 날짜 |
| emotion | text | 감정 10종 키 |  |
| content | text | 기본 '', 코드포인트 600 이하(앱에서 300자 검증) | 본문 |
| photo\_paths | text\[\] | 0\~3개 | 원본 경로 |
| is\_late | boolean |  | 늦은 일기 |
| edited | boolean | 기본 false | 수정됨 표시 |
| created\_at, updated\_at | timestamptz |  |  |

체크 제약: photo\_paths가 1개 이상이거나 content가 비어 있지 않음. 사진 없을 때 5자 이상은 save\_entry에서 문자 단위로 검증.

### entry\_unlocks

| 컬럼 | 타입 | 제약·기본값 | 설명 |
| --- | --- | --- | --- |
| diary\_id, user\_id, entry\_date |  | PK | 열림 기록 |
| created\_at | timestamptz |  |  |

### comments

| 컬럼 | 타입 | 제약·기본값 | 설명 |
| --- | --- | --- | --- |
| id | uuid | PK |  |
| entry\_id | uuid | FK entries on delete cascade |  |
| author\_id | uuid | FK profiles |  |
| content | text | 1\~100자 |  |
| created\_at | timestamptz |  |  |

### reactions

| 컬럼 | 타입 | 제약·기본값 | 설명 |
| --- | --- | --- | --- |
| entry\_id | uuid | PK, FK entries on delete cascade |  |
| user\_id | uuid | PK | 1인 1개 |
| reaction | text | 리액션 6종 키 |  |
| created\_at | timestamptz |  |  |

### notifications

| 컬럼 | 타입 | 제약·기본값 | 설명 |
| --- | --- | --- | --- |
| id | uuid | PK |  |
| user\_id | uuid | FK profiles on delete cascade | 받는 사람 |
| type | text | 알림 종류 표의 타입 |  |
| diary\_id, entry\_id, comment\_id | uuid | FK on delete set null | 대상이 지워져도 알림은 흐리게 남김 |
| actor\_id | uuid | on delete set null | 행동한 사람 |
| actor\_count | int | 기본 1 | 리액션 묶음 수 |
| snapshot | jsonb |  | 닉네임·일기장 이름·날짜 사본(대상 삭제 후 표시용) |
| read\_at | timestamptz | null 허용 |  |
| created\_at | timestamptz |  | NOTI\_RETENTION 기준 |

### user\_settings

| 컬럼 | 타입 | 제약·기본값 | 설명 |
| --- | --- | --- | --- |
| user\_id | uuid | PK |  |
| push\_entry, push\_comment, push\_reaction, push\_membership | boolean | 기본 true | 알림 종류 표의 끄는 스위치 |
| reminder\_on | boolean | 기본 true |  |
| reminder\_time | time | 기본 21:00 |  |
| timezone | text | IANA 이름, 앱 실행 시 갱신 | 리마인드 발송 시각 계산 |

### push\_tokens

| 컬럼 | 타입 | 제약·기본값 | 설명 |
| --- | --- | --- | --- |
| token | text | PK | Expo 푸시 토큰 |
| user\_id | uuid | FK profiles on delete cascade | 기기 여러 대 가능 |
| platform | text | 'ios' / 'android' |  |
| updated\_at | timestamptz |  | 발송 실패 토큰은 삭제 |

### blocks, reports, app\_config

| 테이블 | 컬럼 | 설명 |
| --- | --- | --- |
| blocks | blocker\_id, blocked\_id(PK), created\_at | 차단은 양방향으로 적용 |
| reports | id, reporter\_id, target\_type(entry/comment/profile), target\_id, reason(abuse/photo/spam/etc), memo, status(open/reviewed), created\_at. unique(reporter\_id, target\_type, target\_id) | 운영자가 대시보드에서 처리 |
| app\_config | key, value | min\_version(강제 업데이트) 등 |
| owner\_claims | id, diary\_id, claimant\_id, status(pending/approved/rejected/expired), created\_at, decided\_at. 일기장당 pending 1건(부분 unique) | 주인 장기 미접속 시 주인 맡기 요청(E1) |

### Storage

| 버킷 | 경로 | 접근 |
| --- | --- | --- |
| avatars | {user\_id}.jpg (AVATAR\_SIZE) | 로그인 사용자 읽기, 본인만 쓰기 |
| entry-photos | {diary\_id}/{entry\_id}/{1\~3}.jpg, {1\~3}\_thumb.jpg | 열람 규칙을 통과한 사람만 읽기, 작성자만 쓰기 |

### 서버 함수

| 함수 | 종류 | 하는 일 |
| --- | --- | --- |
| can\_view\_entry(entry) | SQL 함수 | 열람 규칙 판정, entries·comments·reactions·Storage RLS에서 공통 사용 |
| create\_diary | RPC | 일기장 + 주인 멤버 + 초대 코드(함께 쓰기) 생성 |
| request\_join(code) | RPC | 코드 검증, 실패 횟수 집계, 요청 생성 |
| decide\_request(id, approve) | RPC | 승인 시 인원 확인 후 멤버 추가 |
| save\_entry | RPC | 작성 가능 날짜·서버 날짜 범위 검증 → 일기 저장 → 열림 기록 생성 |
| leave\_diary(diary, transfer\_to?) | Edge Function | 위임 또는 탈퇴 처리, 트랜잭션 |
| remove\_member(diary, user) | Edge Function | 내보내기, leave\_diary와 같은 삭제 |
| delete\_diary(diary) | Edge Function | 일기장 전체와 사진 삭제 |
| delete\_account | Edge Function | 모든 일기장 처리 → 프로필·인증 계정 삭제 |
| send\_push | Edge Function (DB 트리거 호출) | 알림 생성 후 설정·차단·뮤트 확인 → Expo Push 발송 |

### 스케줄 작업

| 작업 | 주기 | 하는 일 |
| --- | --- | --- |
| reminder | 30분마다(pg\_cron) | timezone 기준 reminder\_time이 된 사용자 중 오늘 안 쓴 함께 쓰기 일기장이 있으면 1회 발송 |
| expire\_requests | 매일 | 30일 지난 대기 요청 expired 처리 |
| purge | 매일 | 30일 지난 알림, 고아 사진 정리 |
| keepalive | 3일 | GitHub Actions에서 핑 |
| purge\_anonymous | 매일 | 프로필 없이 7일 지난 익명 계정 삭제(가입만 하고 떠난 계정, 남용 대비) |
| owner\_claims | 매일 | 7일 지난 pending 요청을 승인 처리해 주인 위임(owner\_transferred 발송) |

### 삭제 처리 순서

탈퇴·내보내기 시 한 사람의 일기장 데이터 삭제는 이 순서로 한 트랜잭션에서 처리하고, 실패하면 전부 되돌린다.

1. 그 사람이 쓴 entries 삭제 (달린 comments·reactions는 cascade)
2. 다른 일기에 남긴 그 사람의 comments, reactions 삭제
3. 그 사람의 entry\_unlocks 삭제
4. diary\_members 삭제, member\_history 기록
5. 커밋 후 Storage에서 그 사람 일기 사진 삭제(실패하면 purge 작업이 정리)

날짜 계산: 서버 함수의 '오늘'은 그 사용자의 user\_settings.timezone으로 계산한다(can\_view\_entry는 열람자, save\_entry는 작성자, joined\_date는 승인되는 멤버 기준). 앱은 실행·포그라운드 복귀마다 timezone을 갱신한다. save\_entry는 앱이 보낸 오늘이 서버 계산값과 하루 넘게 다르면 device\_date\_invalid로 거부한다. 앱 잠금 PIN은 서버에 저장하지 않는다.

### 접근 정책 (RLS)

익명 사용자도 authenticated 역할이므로 모든 테이블에 RLS를 켜고 아래만 허용한다. 차단 관계와 status = suspended인 사용자의 쓰기는 모든 정책에서 막는다.

| 테이블 | 읽기 | 쓰기 |
| --- | --- | --- |
| profiles | 본인 + 같은 일기장 멤버(차단 관계 제외) | 본인 행만 수정 |
| diaries | 멤버 | 생성은 create\_diary, 수정은 주인 |
| diary\_members | 같은 일기장 멤버 | RPC로만. muted·pinned는 본인 행만 수정 |
| join\_requests | 요청자 본인, 그 일기장 주인 | RPC로만. 요청자는 cancel만 |
| entries | can\_view\_entry 통과 행. 잠긴 일기는 별도 RPC로 작성자 id·날짜만 | save\_entry로 생성·수정, 삭제는 작성자 |
| entry\_unlocks | 본인 | 서버만 |
| comments | 일기가 can\_view\_entry 통과 + 차단·신고 제외 | 생성: 그 일기를 볼 수 있는 멤버. 삭제: 댓글 작성자 또는 일기 작성자 |
| reactions | 일기가 can\_view\_entry 통과 | 본인 행만 생성·변경·삭제 |
| notifications | 본인 | 서버만 생성, 본인은 read\_at만 수정 |
| user\_settings, push\_tokens | 본인 | 본인 |
| blocks | 본인이 차단한 것 | 본인 |
| reports | 본인이 신고한 것 | 생성만 |
| owner\_claims | 그 일기장 멤버 | RPC로만 |
| app\_config | 모두 | 서버만 |

### 인덱스

entries(diary\_id, entry\_date), entries(author\_id, entry\_date), entry\_unlocks(user\_id, diary\_id), comments(entry\_id, created\_at), reactions(entry\_id), notifications(user\_id, created\_at desc), join\_requests(diary\_id, status), diary\_members(user\_id).

### 서버 오류 코드

서버 함수는 아래 코드로 실패를 돌려주고, 앱은 코드별 문구를 한 파일에서 관리한다.

| 코드 | 상황 | 문구 | 화면 |
| --- | --- | --- | --- |
| not\_member | 멤버가 아님(내보내짐·일기장 삭제) | 사라진 일기장이에요 | 공통 |
| entry\_not\_found | 일기가 삭제됨 | 삭제된 일기예요 | D1, D2 |
| entry\_exists | 같은 날짜 일기 있음 | 이미 이날 일기가 있어요 | D1 |
| date\_out\_of\_range | 작성 가능 날짜 밖 | 쓸 수 있는 기간이 지났어요 | D1 |
| device\_date\_invalid | 기기 날짜가 이상함 | 기기 날짜를 확인해 주세요 | D1 |
| too\_short | 사진 없이 5자 미만 | 5자 이상 써 주세요 | D1 |
| code\_invalid | 없는·바뀐 코드, 차단 관계 | 코드를 다시 확인해 주세요 | B3 |
| code\_locked | 실패 10회 | {N}초 후에 다시 시도해 주세요 | B3 |
| already\_member | 이미 멤버 | 이미 함께하고 있어요 | B3 |
| request\_pending | 이미 요청함 | 승인을 기다리고 있어요 | B3 |
| diary\_full | 10명 가득 참 | 자리가 꽉 찼어요 | B3, E2 |
| reject\_cooldown | 거절 후 24시간 이내 | 조금 뒤에 다시 요청할 수 있어요 | B3 |
| request\_closed | 취소·만료·이미 처리된 요청 | 이미 처리된 요청이에요 | B4, E2, F1 |
| rate\_limited | 댓글 도배 | 조금 천천히 남겨 주세요 | D2 |
| already\_reported | 중복 신고 | 이미 신고했어요 | D2 |
| banned\_word | 닉네임·일기장 이름 금지어 | 사용할 수 없는 단어가 있어요 | A4, B2, E1 |
| suspended | 이용 제한 계정 | 이용이 제한된 계정이에요 | A1 |
| network, timeout | 연결 실패·10초 초과 | 잠시 후 다시 시도해 주세요 | 공통 |

### 푸시 데이터

모든 푸시에 `{ type, diary_id, entry_id?, entry_date?, notification_id? }`를 담는다. 앱은 알림 종류 표의 "탭하면" 규칙으로 이동하고, 이동 전에 열람 가능 여부를 다시 확인한다. 앱 아이콘 배지 수는 안 읽은 알림 수와 같다.

## 기술 스택과 개발 환경

모두 무료로 쓸 수 있는 도구로 구성한다. 라이브러리 버전은 착수 시점의 Expo 최신 안정 SDK에 맞춘다.

| 영역 | 선택 | 메모 |
| --- | --- | --- |
| 앱 | Expo + TypeScript, 개발 빌드(dev client) | 네이티브 모듈(애플 로그인, 위젯)이 필요해 Expo Go 대신 개발 빌드 |
| 화면 이동 | Expo Router | 하단 탭 3개 + 일기장 스택 |
| 서버 상태 | TanStack Query | 캐시 우선 표시, 포그라운드 복귀 시 갱신 |
| 백엔드 | supabase-js | 세션은 AsyncStorage |
| 기기 저장 | expo-secure-store(PIN 해시, 실패 횟수), AsyncStorage(임시저장, 화면 설정, 온보딩·권한 요청 기록) |  |
| 사진 | expo-image-picker, expo-image-manipulator(리사이즈·JPEG 재인코딩으로 EXIF 제거), expo-image(캐시 표시) |  |
| 알림 | expo-notifications + Expo Push | 안드로이드는 FCM 설정, iOS는 애플 개발자 계정 필요 |
| 계정 연결 | Supabase 수동 연결(linkIdentity), expo-apple-authentication | 기술 검증 1·2번 |
| 날짜 | dayjs + utc·timezone 플러그인 | 날짜 계산은 한 모듈에서만 |
| 글자 수 | grapheme 분리 라이브러리 | Hermes의 Intl.Segmenter 지원 여부 검증 후 결정 |
| 애니메이션·진동 | react-native-reanimated, expo-haptics | 열림 애니메이션 |
| 오류 수집 | Sentry 무료 플랜(선택) | 출시 전 연결 |
| 배포 | 개발 중 로컬 빌드, 출시는 EAS Build, 작은 수정은 EAS Update |  |

**환경**: Supabase 무료 프로젝트 2개를 dev와 prod로 쓴다. 테이블·RLS·함수는 Supabase CLI 마이그레이션 파일로 git에서 관리하고, Edge Functions도 CLI로 배포한다. 대시보드에서 익명 로그인과 수동 계정 연결을 켜고, 익명 가입 IP 제한(기본 시간당 30회)은 그대로 둔다.

**폴더 구조**

```
app/                 화면(Expo Router). (tabs)/home·notifications·settings, diary/[id]/..., entry/...
src/features/        auth, diary, entry, member, notification, settings
src/lib/             supabase, query, date, image, text(글자 수)
src/constants/       policy.ts(정책 상수표 그대로), emotions.ts, reactions.ts, prompts.ts
src/copy/ko.ts       모든 문구와 오류 코드 문구
src/theme/           tokens.ts(라이트·다크)
supabase/            migrations/, functions/
```

**규칙**: 이슈·커밋·파일 주석에 화면 ID를 붙인다(예: `[C4] 잠긴 카드`). 숫자와 문구는 코드에 직접 쓰지 않고 constants와 copy에서만 가져온다.

### 착수 첫 주 기술 검증

결과에 따라 기획을 고쳐야 할 수 있는 항목이라 기능 개발보다 먼저 확인한다.

1. 익명 계정에 구글 계정을 linkIdentity로 연결하고, 다른 기기에서 그 구글 계정으로 로그인하면 같은 사용자로 들어오는지
2. iOS 애플 로그인으로 익명 계정 연결이 되는지. 구글 로그인을 넣으면 애플 로그인도 함께 제공해야 하는 앱스토어 규정이 있으므로, 안 되면 iOS에서 계정 연결 방식을 다시 정한다
3. Storage 읽기 정책에서 경로의 entry\_id로 can\_view\_entry를 호출할 수 있는지
4. 재인코딩한 JPEG에 위치 정보가 남지 않는지
5. Hermes에서 Intl.Segmenter 사용 가능 여부
6. pg\_cron 30분 작업 → Edge Function → Expo Push 발송 흐름
7. 일주일 이상 요청이 없을 때 GitHub Actions 핑으로 일시정지가 막히는지

## 개발 로드맵

모든 기능을 v1에 넣되, 앞 단계가 뒤 단계의 토대가 되도록 11단계로 만든다.

1. 기반: 착수 첫 주 기술 검증, Expo 프로젝트, Supabase 연결, 익명 로그인, 프로필 만들기, 핑크 테마 토큰 (A1, A3, A4)
2. 일기장: 만들기, 홈 목록, 일기장 설정, 혼자 쓰기 일기장부터 (B1, B2, E1)
3. 일기 작성: 작성·수정·삭제, 사진 압축·썸네일 업로드, 감정 선택, 하루 1개 제약 (D1, D2)
4. 보관 화면: 주간 그리드, 월간 캘린더, 연간 보기, 하루 모아보기 (C1\~C4)
5. 공유: 초대 코드, 참여 요청·승인, 멤버 관리 (B3, B4, E2)
6. 공개 규칙: entry\_unlocks, RLS 정책, 늦은 작성과 자동 공개
7. 반응: 댓글, 리액션 (D2)
8. 알림: 푸시 토큰, 트리거, 알림 화면, 저녁 리마인드 (F1, G3)
9. 탈퇴·삭제: 멤버 탈퇴, 주인 위임·삭제, 주인 맡기 요청, 계정 삭제 Edge Function (E3, G4)
10. 보안·스토어 대응: 앱 잠금, 신고·차단, 개인정보처리방침 (A2, G2, G4)
11. 마무리: 구글/애플 계정 연결, 일시정지 방지 핑, 운영 정책 문서 게시, 검수 시나리오 전체 통과, 스토어 준비 (G1)

공개 규칙은 멤버가 여럿 있어야 테스트할 수 있어 공유 뒤에 둔다. 탈퇴·삭제는 지울 데이터가 모두 생긴 뒤에 만들어야 빠뜨리는 테이블이 없다.

v2 후보(무료로 가능, 구현 난도 순): 일기 PDF 내보내기, 공주 테마 스티커·일기장 꾸미기, 홈 화면 위젯(오늘 열린 친구 일기 미리보기, 네이티브 모듈 필요), 차례형 작성 모드.

## 검수 시나리오

각 단계가 끝날 때 해당 항목을 실제 기기 2\~3대(서로 다른 계정)로 확인한다. 기대 결과와 다르면 기획서 기준으로 고친다.

| ID | 시나리오 | 기대 결과 |
| --- | --- | --- |
| T1 | A가 오늘 일기를 쓰기 전 B의 오늘 일기 보기 | C4에 잠긴 카드, 알림으로 D2에 들어가도 C4로 이동 |
| T2 | A가 오늘 일기 저장 | B의 오늘 일기 열림 + 열림 애니메이션, B는 entry\_created 받음 |
| T3 | A가 저장 후 자기 일기 삭제 | B의 일기는 계속 보임, A는 "아직 안 쓴 공주들"에 표시 |
| T4 | 기간 3일, A가 2일 전 날짜로 작성 | 늦은 일기 배지, 그날 일기 열림, 별도 지각 알림 없음 |
| T5 | 기간 3일, 4일 전 날짜 | 작성 불가, 그날 일기는 이미 모두 공개 |
| T6 | 주인이 기간 7일 → 1일 | 2\~7일 전 일기 즉시 공개, 그 날짜 임시저장은 저장 불가 |
| T7 | 주인이 기간 1일 → 7일 | 이미 공개된 날이 다시 잠기지 않음 |
| T8 | C가 오늘 새로 참여 | 어제까지의 일기는 모두 열림, 오늘 일기는 잠김 |
| T9 | B 탈퇴 | B의 일기·사진·댓글·리액션 삭제, 남은 멤버에게 member\_left |
| T10 | 주인 위임 후 탈퇴 | 새 주인에게 owner\_transferred, 설정 화면 권한 전환 |
| T11 | A가 B 차단 | 서로의 일기·댓글·알림이 안 보임, 같은 일기장 유지, B는 차단 사실 모름 |
| T12 | A가 B 일기 신고 | A에게만 그 일기 숨김, reports 생성 |
| T13 | 서울 A, LA B가 같은 일기장 | 각자 현지 날짜로 작성·열림 판정 |
| T14 | D1을 연 채 자정 경과 후 저장 | 칩 날짜로 저장, is\_late, 기간 밖이면 거부 + 임시저장 유지 |
| T15 | 같은 날짜를 두 기기에서 동시에 저장 | 하나만 저장, 나머지는 entry\_exists |
| T16 | 사진 업로드 중 연결 끊김 | 일기 저장 안 됨, 실패한 사진만 재시도 |
| T17 | 사진 없이 4자 저장 시도 | 저장 버튼 비활성, 서버도 too\_short |
| T18 | 초대 코드 10회 실패 | 60초 입력 잠금 |
| T19 | 10명 일기장 승인 시도 | 승인 불가, diary\_full |
| T20 | 미연결 사용자 재설치 / 연결 사용자 재설치 | 새 계정으로 시작 / 이전 계정 불러오기로 복구 |
| T21 | PIN 5회 실패 후 앱 재실행 | 대기 시간 유지 |
| T22 | 주인인 일기장이 있는 사용자의 계정 삭제 | 위임·삭제 선택 전 버튼 비활성, 삭제 후 모든 데이터 제거 |
| T23 | 오프라인으로 앱 사용 | 캐시 읽기, 쓰기 비활성 + 안내 |
| T24 | 리마인드 21:00, 함께 쓰기 일기장 미작성 | 21:00\~21:30 사이 1회, 모두 썼으면 발송 안 함 |
| T25 | 주인 60일 미접속 → 멤버 맡기 요청 → 7일 경과 | 요청자에게 자동 위임 |
| T26 | 정지된 계정으로 실행 | 이용 제한 안내, 쓰기 불가 |

## 무료 운영

스토어 등록비를 빼면 전부 무료로 만들고 운영할 수 있다. 가장 먼저 한도에 닿는 건 사진 저장 공간 1GB다.

| 항목 | 무료 범위 | 대응 |
| --- | --- | --- |
| Supabase DB | 500MB | 텍스트 위주라 여유 있음 |
| Supabase Storage | 1GB | 장당 200KB 기준 약 5천 장. 사용량이 80%를 넘으면 오래된 사진 해상도 축소 또는 외부 저장소 검토 |
| 대역폭 | 월 5GB | 목록에는 썸네일(긴 변 400px)만 내려받고 원본은 상세에서만 로드, 이미지 캐시 사용 |
| 사용자 수 | 월 5만 명 | 충분 |
| Edge Functions | 월 50만 회 | 탈퇴 처리, 푸시 발송에 충분 |
| 자동 일시정지 | 7일간 요청 없으면 정지 | GitHub Actions 예약 작업으로 3일마다 핑 |
| 푸시 알림 | Expo Push 무료 | 그대로 사용 |
| 빌드 | 로컬 빌드 무료, EAS 무료 횟수 | 출시 빌드만 EAS, 개발 중엔 로컬 |
| 스토어 등록 | 애플 연 $99, 구글 1회 $25 | 처음엔 안드로이드 APK 직접 배포로 시작, 이후 구글 플레이, 마지막에 iOS |

썸네일은 업로드 시 원본과 함께 만들어 `{1~3}_thumb.jpg`로 저장한다. 무료 플랜 수치는 2026년 기준이며 출시 전 supabase.com/pricing에서 다시 확인한다.

출처: [Supabase 무료 플랜 한도 정리](https://automationatlas.io/answers/supabase-free-tier-limits-2026/), [일시정지 규칙과 대응](https://www.itpathsolutions.com/supabase-free-tier-limits)

## 운영 정책

출시 전에 이용약관·개인정보처리방침 페이지(GitHub Pages, 무료)를 이 내용으로 작성한다.

**수집하는 정보**: 익명 사용자 ID, 닉네임·아바타, 일기(본문·사진·감정·날짜), 댓글·리액션, 신고·차단 기록, 푸시 토큰, 기기 시간대. 계정을 연결하면 구글·애플 계정 식별자와 이메일이 인증 시스템에 저장되지만 앱 기능에는 쓰지 않는다. 계정 삭제 시 지체 없이 삭제한다.

**이용약관 필수 조항**: 만 14세 이상 이용, 불쾌한 콘텐츠와 괴롭힘에 대한 무관용 원칙, 위반 시 콘텐츠 삭제와 이용 제한, 신고·차단 방법, 문의처.

**신고 처리**: 운영자(개발자)가 매일 Supabase 대시보드에서 status = open인 신고를 확인하고 24시간 안에 처리한다. 조치는 콘텐츠 삭제, 계정 정지(profiles.status = suspended), 조치 없음 중 하나이며 처리 후 status = reviewed로 바꾼다.

**금지어**: 공개된 한국어 비속어 목록을 app\_config의 banned\_words에 넣어 닉네임과 일기장 이름에만 적용하고, 운영하며 추가한다. 일기 본문과 댓글은 검사하지 않고 신고로 대응한다.

**문의처**: 앱 전용 이메일(무료 메일 서비스) 1개를 만들어 G1 문의하기, 스토어 정보, 약관에 같은 주소를 쓴다.
