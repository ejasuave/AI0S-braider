import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @internal Exported for unit tests. */
export function applyEnvFile(content: string, target: NodeJS.ProcessEnv = process.env): void {
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    if (!key) continue;

    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Shell overrides like STRIPE_SECRET_KEY= must not block loading real keys from `.env`.
    const existing = target[key];
    if (existing !== undefined && existing !== '') continue;

    target[key] = value;
  }
}

const moduleDir = fileURLToPath(new URL('.', import.meta.url));
const envCandidates = [
  resolve(moduleDir, '../../../.env'),
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
];

for (const envPath of envCandidates) {
  if (!existsSync(envPath)) continue;
  applyEnvFile(readFileSync(envPath, 'utf8'));
  break;
}
