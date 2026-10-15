/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

/**
 * Dedicated Vitest project for `storage.rules` tests against the Firebase Storage
 * emulator. Deliberately SEPARATE from the root `vitest.config.ts` (whose
 * `include` is anchored to `src/**`) so this file:
 *   - never runs as part of `npm test` / `npm run test:run` / `npm run pre-commit`
 *   - never needs the emulator to be up for the normal (mocked-API) suite/CI
 *
 * Run with: `npm run test:storage-rules` (spins up the emulator via
 * `firebase emulators:exec`, see package.json).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['storage-rules-tests/**/*.test.ts'],
    // These tests talk to a real (emulated) network service — the default
    // jsdom-tuned timeouts from the root config don't apply here and 5s is
    // occasionally tight for the first request against a cold emulator.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
})
