const LEVELS = new Set(['off', 'info', 'warn', 'fail']);

export const PATH_DEFAULTS = Object.freeze({
  code: [
    '**/*.js', '**/*.mjs', '**/*.cjs', '**/*.ts', '**/*.tsx', '**/*.jsx',
    '**/*.py', '**/*.rb', '**/*.go', '**/*.rs', '**/*.java', '**/*.kt',
    '**/*.c', '**/*.cc', '**/*.cpp', '**/*.h', '**/*.hpp', '**/*.cs',
    '**/*.php', '**/*.swift', '**/*.scala', '**/*.sh', '**/*.bash',
    '**/*.ex', '**/*.exs', '**/*.erl', '**/*.hrl', '**/*.lua', '**/*.dart'
  ],
  tests: [
    '**/test/**', '**/tests/**', '**/__tests__/**', '**/spec/**',
    '**/*_test.*', '**/*Test.*', '**/*.test.*', '**/*.spec.*'
  ],
  docs: ['docs/**', '**/*.md', '**/*.mdx', 'README*', 'LICENSE*', 'CODE_OF_CONDUCT*'],
  changelog: ['CHANGELOG*', 'CHANGES*', 'NEWS*', '.changeset/**', 'changes/**'],
  generated: [
    '**/dist/**', '**/build/**', '**/vendor/**', '**/generated/**',
    '**/*.min.js', '**/*.min.css', '**/*.map', '**/*.snap',
    '**/package-lock.json', '**/pnpm-lock.yaml', '**/yarn.lock',
    '**/bun.lock', '**/bun.lockb', '**/Cargo.lock', '**/poetry.lock',
    '**/uv.lock', '**/Gemfile.lock', '**/composer.lock'
  ],
  dependencyManifest: [
    'package.json', '**/package.json', 'pyproject.toml', '**/pyproject.toml',
    'requirements*.txt', '**/requirements*.txt', 'Pipfile', '**/Pipfile',
    'Cargo.toml', '**/Cargo.toml', 'go.mod', '**/go.mod',
    'Gemfile', '**/Gemfile', 'pom.xml', '**/pom.xml',
    'build.gradle*', '**/build.gradle*', 'composer.json', '**/composer.json'
  ],
  lockfile: [
    'package-lock.json', '**/package-lock.json', 'pnpm-lock.yaml', '**/pnpm-lock.yaml',
    'yarn.lock', '**/yarn.lock', 'bun.lock', '**/bun.lock', 'bun.lockb', '**/bun.lockb',
    'Cargo.lock', '**/Cargo.lock', 'poetry.lock', '**/poetry.lock', 'uv.lock', '**/uv.lock',
    'Pipfile.lock', '**/Pipfile.lock', 'Gemfile.lock', '**/Gemfile.lock',
    'go.sum', '**/go.sum', 'composer.lock', '**/composer.lock'
  ],
  sensitive: [
    '.github/workflows/**', '**/CODEOWNERS', 'Dockerfile', '**/Dockerfile',
    '**/security/**', '**/auth/**', '**/permissions/**', '**/crypto/**',
    '**/secrets/**', '**/migrations/**', '**/middleware/**'
  ],
  workflow: ['.github/workflows/**'],
  credential: [
    '.env', '.env.*', '**/.env', '**/.env.*', '**/*.pem', '**/*.key', '**/*.p12',
    '**/*.pfx', '**/id_rsa', '**/id_ed25519', '**/credentials.json', '**/service-account*.json'
  ],
  migration: ['**/migrations/**', '**/migrate/**', '**/schema.sql', '**/schema.prisma'],
  publicApi: [
    'src/index.*', 'lib/index.*', 'index.*', '**/api/**', '**/public/**',
    '**/exports/**', '**/include/**', '**/*.d.ts', '**/mod.rs', '**/__init__.py'
  ],
  binary: [
    '**/*.exe', '**/*.dll', '**/*.so', '**/*.dylib', '**/*.jar', '**/*.class',
    '**/*.zip', '**/*.tar', '**/*.gz', '**/*.7z', '**/*.pdf', '**/*.png',
    '**/*.jpg', '**/*.jpeg', '**/*.gif', '**/*.webp', '**/*.woff', '**/*.woff2'
  ],
  ignore: []
});

const BASE_RULES = Object.freeze({
  'missing-title': { level: 'fail', weight: 1 },
  'short-title': { level: 'warn', weight: 0.5, minLength: 12 },
  'draft-pr': { level: 'info', weight: 0 },
  'thin-description': { level: 'warn', weight: 1, minLength: 100 },
  'required-sections': { level: 'off', weight: 1, sections: ['Summary', 'Testing'] },
  'missing-issue-link': { level: 'off', weight: 1 },
  'unchecked-tasks': { level: 'warn', weight: 0.5 },
  'many-files': { level: 'warn', weight: 1, max: 30, failAt: 75 },
  'large-diff': { level: 'warn', weight: 1, max: 800, failAt: 2000 },
  'large-file': { level: 'warn', weight: 0.7, max: 500, failAt: 1500 },
  'missing-tests': { level: 'warn', weight: 1.2 },
  'low-test-ratio': { level: 'info', weight: 0.5, minRatio: 0.15, minCodeLines: 120 },
  'deleted-tests': { level: 'warn', weight: 1 },
  'missing-changelog': { level: 'off', weight: 0.7 },
  'dependency-change': { level: 'warn', weight: 0.7 },
  'manifest-without-lockfile': { level: 'info', weight: 0.4 },
  'sensitive-change': { level: 'warn', weight: 1 },
  'workflow-permissions': { level: 'fail', weight: 1.3 },
  'unsafe-pr-target-checkout': { level: 'fail', weight: 1.5 },
  'credential-file': { level: 'fail', weight: 1.5 },
  'secret-pattern': { level: 'fail', weight: 1.5 },
  'migration-change': { level: 'warn', weight: 0.8 },
  'public-api-change': { level: 'info', weight: 0.5 },
  'generated-heavy': { level: 'warn', weight: 0.7, ratio: 0.6, minFiles: 3 },
  'binary-change': { level: 'warn', weight: 0.8 },
  'unpinned-action': { level: 'warn', weight: 0.8, exemptOwners: ['actions', 'github'] },
  'lockfile-only': { level: 'info', weight: 0 }
});

export const PRESETS = Object.freeze({
  balanced: {},
  strict: {
    rules: {
      'required-sections': { level: 'warn' },
      'missing-issue-link': { level: 'warn' },
      'low-test-ratio': { level: 'warn', minRatio: 0.2 },
      'missing-changelog': { level: 'warn' },
      'manifest-without-lockfile': { level: 'warn' },
      'public-api-change': { level: 'warn' },
      'unpinned-action': { level: 'fail' }
    }
  },
  library: {
    rules: {
      'required-sections': { level: 'warn', sections: ['Summary', 'Testing', 'Compatibility'] },
      'missing-issue-link': { level: 'warn' },
      'low-test-ratio': { level: 'warn', minRatio: 0.2 },
      'missing-changelog': { level: 'warn' },
      'manifest-without-lockfile': { level: 'info' },
      'public-api-change': { level: 'warn' }
    }
  },
  docs: {
    rules: {
      'thin-description': { minLength: 60 },
      'missing-tests': { level: 'off' },
      'low-test-ratio': { level: 'off' },
      'missing-changelog': { level: 'off' },
      'public-api-change': { level: 'off' }
    }
  }
});

export const RULE_META = Object.freeze({
  'missing-title': { category: 'Description', title: 'PR title is missing', description: 'Require a non-empty pull-request title.' },
  'short-title': { category: 'Description', title: 'PR title is very short', description: 'Warn when the title is too short to describe an outcome.' },
  'draft-pr': { category: 'Workflow', title: 'Pull request is a draft', description: 'Mark draft pull requests as informational or skip them.' },
  'thin-description': { category: 'Description', title: 'Description needs more context', description: 'Require enough context for a reviewer to start.' },
  'required-sections': { category: 'Description', title: 'Required PR sections are missing', description: 'Require configured Markdown headings in the PR body.' },
  'missing-issue-link': { category: 'Traceability', title: 'No linked issue found', description: 'Require a closing issue reference or issue URL.' },
  'unchecked-tasks': { category: 'Description', title: 'PR checklist is incomplete', description: 'Surface unchecked PR-template tasks.' },
  'many-files': { category: 'Scope', title: 'Large file surface', description: 'Flag a broad file surface.' },
  'large-diff': { category: 'Scope', title: 'Large diff', description: 'Flag a high total line count.' },
  'large-file': { category: 'Scope', title: 'Large individual file diff', description: 'Flag a single unusually large changed file.' },
  'missing-tests': { category: 'Testing', title: 'Code changed without test changes', description: 'Flag source changes without test changes.' },
  'low-test-ratio': { category: 'Testing', title: 'Test-change signal is low', description: 'Compare changed test lines to changed code lines.' },
  'deleted-tests': { category: 'Testing', title: 'Test files were removed', description: 'Flag removed test files.' },
  'missing-changelog': { category: 'Release', title: 'No changelog entry detected', description: 'Require release notes for code changes when enabled.' },
  'dependency-change': { category: 'Supply chain', title: 'Dependency surface changed', description: 'Call attention to dependency-manifest changes.' },
  'manifest-without-lockfile': { category: 'Supply chain', title: 'Manifest changed without lockfile', description: 'Flag manifest changes without a lockfile update.' },
  'sensitive-change': { category: 'Security', title: 'Sensitive paths changed', description: 'Call attention to configured sensitive paths.' },
  'workflow-permissions': { category: 'Security', title: 'Broad workflow permissions added', description: 'Detect newly added broad GitHub Actions write permissions.' },
  'unsafe-pr-target-checkout': { category: 'Security', title: 'Unsafe pull_request_target checkout', description: 'Detect privileged pull_request_target workflows that check out pull-request-controlled code.' },
  'credential-file': { category: 'Security', title: 'Credential-like file changed', description: 'Block likely credential or private-key files.' },
  'secret-pattern': { category: 'Security', title: 'Possible secret added', description: 'Detect a small set of high-confidence secret patterns in added lines.' },
  'migration-change': { category: 'Operations', title: 'Migration or schema changed', description: 'Call attention to database or schema migrations.' },
  'public-api-change': { category: 'Compatibility', title: 'Likely public API changed', description: 'Call attention to likely public API surface changes.' },
  'generated-heavy': { category: 'Reviewability', title: 'Diff is dominated by generated files', description: 'Flag diffs dominated by generated files.' },
  'binary-change': { category: 'Reviewability', title: 'Binary artifacts changed', description: 'Call attention to binary artifacts that cannot be line-reviewed.' },
  'unpinned-action': { category: 'Supply chain', title: 'Third-party Action is not SHA-pinned', description: 'Detect newly added third-party Actions that are not pinned to a full commit SHA.' },
  'lockfile-only': { category: 'Supply chain', title: 'Lockfile-only change', description: 'Identify lockfile-only pull requests.' }
});

export const BASE_CONFIG = Object.freeze({
  preset: 'balanced',
  skipDrafts: false,
  skipLabels: ['pr-rigor:skip'],
  waiverLabels: {
    'pr-rigor:tests-not-needed': ['missing-tests', 'low-test-ratio'],
    'pr-rigor:changelog-not-needed': ['missing-changelog'],
    'pr-rigor:generated-ok': ['generated-heavy'],
    'pr-rigor:risk-reviewed': ['sensitive-change', 'migration-change', 'public-api-change']
  },
  scoring: { warn: 7, fail: 24 },
  rules: BASE_RULES,
  paths: PATH_DEFAULTS
});

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function deepMerge(base, override) {
  if (!isPlainObject(override)) return override === undefined ? base : override;
  const result = { ...(isPlainObject(base) ? base : {}) };
  for (const [key, value] of Object.entries(override)) {
    if (isPlainObject(value) && isPlainObject(result[key])) result[key] = deepMerge(result[key], value);
    else result[key] = value;
  }
  return result;
}

export function resolveConfig(userConfig = {}, presetOverride = '') {
  const presetName = presetOverride || userConfig.preset || BASE_CONFIG.preset;
  if (!Object.hasOwn(PRESETS, presetName)) {
    throw new Error(`Unknown preset "${presetName}". Expected one of: ${Object.keys(PRESETS).join(', ')}.`);
  }
  const withoutPreset = { ...userConfig };
  delete withoutPreset.preset;
  const withPreset = deepMerge(BASE_CONFIG, PRESETS[presetName]);
  const resolved = deepMerge(withPreset, withoutPreset);
  resolved.preset = presetName;
  validateConfig(resolved);
  return resolved;
}

export function validateConfig(config) {
  const errors = [];
  if (!isPlainObject(config)) errors.push('Configuration must be a JSON object.');
  if (!isPlainObject(config?.rules)) errors.push('rules must be an object.');
  if (!isPlainObject(config?.paths)) errors.push('paths must be an object.');

  for (const [ruleId, value] of Object.entries(config?.rules || {})) {
    if (!Object.hasOwn(BASE_RULES, ruleId)) errors.push(`Unknown rule: ${ruleId}.`);
    if (!isPlainObject(value)) {
      errors.push(`Rule ${ruleId} must be an object.`);
      continue;
    }
    if (!LEVELS.has(value.level)) errors.push(`Rule ${ruleId}.level must be off, info, warn, or fail.`);
    if (value.weight !== undefined && (!Number.isFinite(value.weight) || value.weight < 0)) {
      errors.push(`Rule ${ruleId}.weight must be a non-negative number.`);
    }
  }

  for (const [kind, patterns] of Object.entries(config?.paths || {})) {
    if (!Array.isArray(patterns) || patterns.some((pattern) => typeof pattern !== 'string')) {
      errors.push(`paths.${kind} must be an array of strings.`);
    }
  }

  if (!Array.isArray(config?.skipLabels)) errors.push('skipLabels must be an array.');
  if (!isPlainObject(config?.waiverLabels)) errors.push('waiverLabels must be an object.');
  if (!Number.isFinite(config?.scoring?.warn) || config.scoring.warn < 0) errors.push('scoring.warn must be non-negative.');
  if (!Number.isFinite(config?.scoring?.fail) || config.scoring.fail < 0) errors.push('scoring.fail must be non-negative.');

  if (errors.length) throw new Error(`Invalid PR Rigor configuration:\n- ${errors.join('\n- ')}`);
  return true;
}

export function configTemplate(preset = 'balanced') {
  if (!Object.hasOwn(PRESETS, preset)) throw new Error(`Unknown preset: ${preset}`);
  return `${JSON.stringify({
    $schema: './schemas/pr-rigor.schema.json',
    preset,
    skipDrafts: false,
    skipLabels: ['pr-rigor:skip'],
    rules: {
      'required-sections': { level: 'off', sections: ['Summary', 'Testing'] },
      'missing-issue-link': { level: 'off' },
      'missing-changelog': { level: preset === 'library' || preset === 'strict' ? 'warn' : 'off' }
    },
    paths: { ignore: ['docs/generated/**'] }
  }, null, 2)}\n`;
}

export function listRules() {
  return Object.entries(RULE_META).map(([id, meta]) => ({ id, ...meta }));
}
