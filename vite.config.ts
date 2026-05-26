import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { UserConfig } from 'vitest/config'

const testConfig: UserConfig['test'] = {
  globals: true,
  environment: 'jsdom',
  setupFiles: ['./src/tests/setup.ts'],
  exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
}

export default defineConfig({
  plugins: [react()],
  // @ts-expect-error vitest extends vite config
  test: testConfig,
})
