import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/** 현재 로그인 사용자 id(세션 변화 반영) */
export function useMyUserId(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setId(data.session?.user.id ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setId(s?.user.id ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  return id;
}
