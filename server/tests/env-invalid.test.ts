import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const serverRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('env startup validation', () => {
  it('refuses to start when JWT_SECRET is too short', () => {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', '-e', 'import("./src/config/env.ts")'],
      {
        cwd: serverRoot,
        env: {
          ...process.env,
          NODE_ENV: 'test',
          JWT_SECRET: 'short',
          DATABASE_URL: 'postgresql://legalconnect:ci@localhost:5432/legalconnect',
          CLIENT_ORIGIN: 'http://localhost:5173',
        },
        encoding: 'utf8',
      },
    );

    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toMatch(/Invalid environment configuration/);
  });
});
