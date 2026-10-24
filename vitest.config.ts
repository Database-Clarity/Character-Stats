import { defineConfig } from 'vitest/config';
export default defineConfig({
    test: { environment: 'node', include: ['tests/**/*.test.ts', 'src/editor/**/*.test.ts'] },
});
