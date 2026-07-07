import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 120000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        // Startup bootstraps — call process.exit / real DB / HTTP server; not unit-testable.
        'src/server.ts',
        'src/app.ts',
        'src/config/env.ts',
        'src/config/db.ts',
        // Socket.io initialisation + emit helpers require a live server; tested via mock contract.
        'src/config/socket.ts',
        // Swagger spec — generated config boilerplate, no logic.
        'src/docs/swagger.ts',
        // Operational scripts (seed, migrations) — run manually against live DB.
        'src/scripts/**',
        // Test files themselves.
        'src/**/*.test.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
