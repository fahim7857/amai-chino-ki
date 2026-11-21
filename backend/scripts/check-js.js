import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function collectJsFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectJsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

const root = process.cwd();
const files = [
  ...collectJsFiles(path.join(root, 'backend')),
  ...collectJsFiles(path.join(root, 'frontend', 'assets', 'js')),
];

for (const file of files) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}

console.log(`Syntax check passed for ${files.length} JavaScript files.`);
