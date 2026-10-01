/**
 * Windows-safe Prisma CLI launcher.
 * npm's prisma.cmd tries to execute index.js directly; Node must run it.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'node_modules', 'prisma', 'build', 'index.js');
const args = process.argv.slice(2);

function printWindowsFix() {
  console.error('');
  console.error('Windows fix (try ALL of these):');
  console.error('');
  console.error('A) Controlled folder access (most common for errno -4094):');
  console.error('   Windows Security → Virus & threat protection → Ransomware protection');
  console.error('   → Manage ransomware protection → Allow an app through Controlled folder access');
  console.error('   → Add: node.exe (often under C:\\Program Files\\nodejs\\node.exe)');
  console.error('');
  console.error('B) Defender exclusion folder:');
  console.error(`   ${join(root, 'node_modules', 'prisma')}`);
  console.error('');
  console.error('C) Reinstall prisma after exclusions:');
  console.error('   Remove-Item -Recurse -Force node_modules\\prisma');
  console.error('   npm install');
  console.error('');
  console.error('D) Or run migrate on PI server (no local Windows issues):');
  console.error('   docker exec programai_backend sh -lc "npx prisma migrate deploy"');
  console.error('');
}

if (!existsSync(cli)) {
  console.error('ERROR: Prisma CLI file is missing:');
  console.error(`  ${cli}`);
  printWindowsFix();
  process.exit(1);
}

try {
  readFileSync(cli, 'utf8');
} catch (e) {
  console.error('ERROR: Prisma CLI exists but Node cannot read it (antivirus / Controlled folder access):');
  console.error(`  ${cli}`);
  console.error(`  ${e instanceof Error ? e.message : e}`);
  printWindowsFix();
  process.exit(1);
}

const result = spawnSync(process.execPath, [cli, ...args], {
  stdio: 'inherit',
  cwd: root,
  env: process.env,
});

process.exit(result.status ?? 1);
