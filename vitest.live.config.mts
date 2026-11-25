import { defineConfig } from 'vitest/config';
import path from 'node:path';

// dev 서버 E2E 전용 설정(pnpm test:live). CI에서는 돌리지 않는다.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: { include: ['supabase/tests/live/**/*.test.ts'], environment: 'node', testTimeout: 30_000, fileParallelism: false },
});
