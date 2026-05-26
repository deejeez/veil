import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { UserConfig } from 'vitest/config'

const testConfig: UserConfig['test'] = {
  environment: 'jsdom',
  setupFiles: ['./src/tests/setup.ts'],
}

export default defineConfig({
  plugins: [react()],
  // @ts-expect-error vitest extends vite config
  test: testConfig,
})
