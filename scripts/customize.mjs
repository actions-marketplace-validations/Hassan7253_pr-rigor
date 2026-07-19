import fs from 'node:fs/promises';
import path from 'node:path';

function parse(argv) {
  const values = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    values[key] = value;
    i += 1;
  }
  return values;
}

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (/\.(?:md|json|ya?ml|js|mjs|cff|txt)$/.test(entry.name) || ['LICENSE', 'CODEOWNERS'].includes(entry.name)) files.push(full);
  }
  return files;
}

const args = parse(process.argv.slice(2));
const owner = args.owner;
const name = args.name;
const npmScope = (args['npm-scope'] || owner || '').replace(/^@/, '').toLowerCase();
if (!owner || !/^[A-Za-z0-9-]+$/.test(owner)) throw new Error('Use --owner with your GitHub username or organization.');
if (!name) throw new Error('Use --name with your display name.');
if (!/^[a-z0-9][a-z0-9-]*$/.test(npmScope)) throw new Error('The npm scope must contain lowercase letters, digits, and hyphens.');

const replacements = new Map([
  ['Hassan7253', owner],
  ['Hassan7253', name],
  ['hassan7253', npmScope]
]);

for (const file of await walk('.')) {
  let text;
  try {
    text = await fs.readFile(file, 'utf8');
  } catch {
    continue;
  }
  let next = text;
  for (const [from, to] of replacements) next = next.replaceAll(from, to);
  if (next !== text) await fs.writeFile(file, next, 'utf8');
}

const packageFile = JSON.parse(await fs.readFile('package.json', 'utf8'));
packageFile.name = `@${npmScope}/pr-rigor`;
packageFile.author = name;
await fs.writeFile('package.json', `${JSON.stringify(packageFile, null, 2)}\n`, 'utf8');
console.log(`Customized PR Rigor for ${owner}. npm package: @${npmScope}/pr-rigor`);
