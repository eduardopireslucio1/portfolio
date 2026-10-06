// The Strava scripts read their keys from .env.local (git-ignored), so nothing has to be exported by hand.
// Variables already set in the environment (e.g. GitHub Actions secrets) win over the file.
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';

export const ENV_FILE = new URL('../.env.local', import.meta.url);

export function loadEnv() {
  if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
}

export function requireEnv(...names) {
  const missing = names.filter((name) => !process.env[name]);
  if (!missing.length) return;
  throw new Error(
    `Missing ${missing.join(', ')}.\n` +
      `Put them in .env.local at the project root (one per line, e.g. STRAVA_CLIENT_ID=12345).\n` +
      `Client ID and Client Secret are on https://www.strava.com/settings/api`,
  );
}

// Sets one KEY=value line in .env.local, replacing it if present.
export async function saveEnv(name, value) {
  const text = existsSync(ENV_FILE) ? await readFile(ENV_FILE, 'utf8') : '';
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, 'm');
  const next = pattern.test(text) ? text.replace(pattern, line) : `${text}${text && !text.endsWith('\n') ? '\n' : ''}${line}\n`;
  await writeFile(ENV_FILE, next, { mode: 0o600 });
}
