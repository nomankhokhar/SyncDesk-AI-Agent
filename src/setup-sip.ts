import 'dotenv/config';
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Renders the ${VAR} placeholders in the trunk/dispatch JSON templates
// from .env, then creates the LiveKit SIP objects with the lk CLI.
// Keeps Telnyx credentials out of git — only the templates are committed.
//
// Usage: npm run setup:sip   (requires `lk cloud auth` first)

const render = (file: string): string =>
  readFileSync(file, 'utf8').replace(/\$\{(\w+)\}/g, (_, name: string) => {
    const value = process.env[name];
    if (!value) {
      console.error(`Missing ${name} in .env (needed by ${file})`);
      process.exit(1);
    }
    // JSON-escape so special characters in passwords can't break the file
    return JSON.stringify(value).slice(1, -1);
  });

const dir = mkdtempSync(join(tmpdir(), 'sip-'));

for (const [file, cmd] of [
  ['inbound-trunk.json', 'lk sip inbound create'],
  ['dispatch-rule.json', 'lk sip dispatch create'],
  ['outbound-trunk.json', 'lk sip outbound create'],
] as const) {
  const rendered = join(dir, file);
  writeFileSync(rendered, render(file));
  console.log(`\n$ ${cmd} ${file}`);
  execSync(`${cmd} ${rendered}`, { stdio: 'inherit' });
}

console.log('\nDone. Put the outbound trunk ID (ST_...) in .env as SIP_OUTBOUND_TRUNK_ID.');
