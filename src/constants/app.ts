/**
 * 앱 외부 연결 정보. 출시 전에 실제 값으로 바꾼다(docs/spec.md '운영 정책').
 * TODO: 앱 전용 문의 이메일, 약관·개인정보처리방침 GitHub Pages 주소 확정
 */
export const CONTACT_EMAIL = '';
export const TERMS_URL = '';
export const PRIVACY_URL = '';
export const STORE_URL = { ios: '', android: '' } as const;

/**
 * [B2, E1] 초대 링크. screens.md 공통 규칙 딥링크: gongju://join/{코드}, https://{도메인}/j/{코드}
 * TODO: 웹 도메인이 정해지면 https 링크로 바꾼다
 */
export const INVITE_LINK = (code: string) => `gongju://join/${code}`;
