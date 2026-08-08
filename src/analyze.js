import { matchesAny, normalizePath } from './glob.js';
import { RULE_META, resolveConfig } from './config.js';

const SECRET_PATTERNS = [
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/],
  ['AWS access key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{30,}\b/]
];

function cleanFile(file) {
  const additions = Number(file?.additions || 0);
  const deletions = Number(file?.deletions || 0);
  return {
    filename: normalizePath(file?.filename || file?.path || ''),
    additions,
    deletions,
    changes: Number(file?.changes ?? additions + deletions),
    status: String(file?.status || 'modified'),
    patch: typeof file?.patch === 'string' ? file.patch : ''
  };
}

function normalizeLabels(value) {
  const labels = Array.isArray(value) ? value : [];
  return labels.map((item) => typeof item === 'string' ? item : String(item?.name || '')).filter(Boolean);
}

function classify(files, config) {
  const included = files.filter((file) => !matchesAny(file.filename, config.paths.ignore));
  const select = (kind) => included.filter((file) => matchesAny(file.filename, config.paths[kind] || []));
  return {
    included,
    code: select('code'),
    tests: select('tests'),
    docs: select('docs'),
    changelog: select('changelog'),
    generated: select('generated'),
    dependencyManifest: select('dependencyManifest'),
    lockfile: select('lockfile'),
    sensitive: select('sensitive'),
    workflow: select('workflow'),
    credential: select('credential'),
    migration: select('migration'),
    publicApi: select('publicApi'),
    binary: select('binary')
  };
}

function addedLines(patch) {
  return String(patch || '')
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1));
}

function visiblePatchLines(patch) {
  return String(patch || '')
    .split('\n')
    .filter((line) => line && !line.startsWith('@@') && !line.startsWith('---') && !line.startsWith('+++') && !line.startsWith('-') && !line.startsWith('\\'))
    .map((line) => line.startsWith('+') || line.startsWith(' ') ? line.slice(1) : line);
}

function headings(body) {
  return [...String(body || '').matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gim)]
    .map((match) => match[1].trim().toLowerCase());
}

function hasIssueLink(body) {
  const text = String(body || '');
  return /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+(?:[\w.-]+\/[\w.-]+)?#\d+\b/i.test(text)
    || /https?:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+/i.test(text);
}

function uncheckedTasks(body) {
  return [...String(body || '').matchAll(/^\s*[-*]\s+\[ \]\s+(.+)$/gim)].map((match) => match[1].trim());
}

function samplePaths(files, limit = 6) {
  const values = files.map((file) => file.filename);
  if (values.length <= limit) return values;
  return [...values.slice(0, limit), `...and ${values.length - limit} more`];
}

function pathEvidence(files, message = '') {
  return files.map((file) => ({ path: file.filename, message }));
}

function dynamicLevel(rule, value, failAt) {
  if (rule.level === 'off') return 'off';
  if (Number.isFinite(failAt) && value >= failAt) return 'fail';
  return rule.level;
}

function createFinding(config, id, detail, evidence = [], suggestion = '', levelOverride = '') {
  const rule = config.rules[id];
  const level = levelOverride || rule.level;
  if (level === 'off') return null;
  const meta = RULE_META[id] || { category: 'Other', title: id };
  return {
    id,
    category: meta.category,
    level,
    weight: Number(rule.weight ?? 1),
    title: meta.title,
    detail,
    evidence,
    suggestion
  };
}

function findSecretMatches(files) {
  const matches = [];
  for (const file of files) {
    for (const line of addedLines(file.patch)) {
      for (const [name, pattern] of SECRET_PATTERNS) {
        if (pattern.test(line)) {
          matches.push({ path: file.filename, message: `${name} pattern in an added line` });
          break;
        }
      }
    }
  }
  return matches;
}

function findWorkflowPermissionRisks(files) {
  const risks = [];
  const risky = [
    /\bpermissions\s*:\s*write-all\b/i,
    /^\s*(?:contents|actions|checks|deployments|id-token|issues|packages|pages|pull-requests|security-events|statuses)\s*:\s*write\s*$/i
  ];
  for (const file of files) {
    const lines = addedLines(file.patch);
    if (lines.some((line) => risky.some((pattern) => pattern.test(line)))) {
      risks.push({ path: file.filename, message: 'new broad write permission' });
    }
  }
  return risks;
}

function findUnpinnedActions(files, exemptOwners) {
  const findings = [];
  const allowedOwners = new Set((exemptOwners || []).map((value) => value.toLowerCase()));
  for (const file of files) {
    for (const line of addedLines(file.patch)) {
      const match = line.match(/^\s*-?\s*uses:\s*([^\s@]+)@([^\s#]+)(?:\s*#.*)?$/i);
      if (!match || match[1].startsWith('./') || match[1].startsWith('docker://')) continue;
      const owner = match[1].split('/')[0].toLowerCase();
      const ref = match[2];
      if (allowedOwners.has(owner)) continue;
      if (!/^[0-9a-f]{40}$/i.test(ref)) {
        findings.push({ path: file.filename, message: `${match[1]}@${ref}` });
      }
    }
  }
  return findings;
}

function findUnsafePullRequestTargetCheckouts(files) {
  const findings = [];
  const targetTrigger = /(?:^|[\s[,])['"]?pull_request_target['"]?(?:\s*:|\s*(?:,|\])|\s*$)/i;
  const checkoutAction = /^\s*-?\s*uses:\s*actions\/checkout@/i;
  const unsafeCheckoutInput = /^\s*allow-unsafe-pr-checkout\s*:\s*(?:true|['"]true['"])\s*(?:#.*)?$/i;
  const pullRequestHeadInput = /^\s*(?:ref|repository)\s*:\s*.*(?:github\.head_ref|github\.event\.pull_request\.head(?:\.(?:sha|ref|repo\.full_name))?|refs\/pull\/.*\/(?:head|merge))/i;
  const ghCheckout = /\bgh\s+pr\s+checkout\b/i;
  const gitCheckout = /\bgit\s+(?:fetch|checkout|switch)\b.*(?:github\.head_ref|github\.event\.pull_request\.head|refs\/pull\/.*\/(?:head|merge))/i;

  for (const file of files) {
    const visible = visiblePatchLines(file.patch).filter((line) => !line.trimStart().startsWith('#'));
    const added = addedLines(file.patch).filter((line) => !line.trimStart().startsWith('#'));
    if (!visible.some((line) => targetTrigger.test(line))) continue;

    const hasCheckoutAction = visible.some((line) => checkoutAction.test(line));
    const hasUnsafeInput = visible.some((line) => unsafeCheckoutInput.test(line));
    const hasPullRequestHeadInput = visible.some((line) => pullRequestHeadInput.test(line));
    const hasGhCheckout = visible.some((line) => ghCheckout.test(line));
    const hasGitCheckout = visible.some((line) => gitCheckout.test(line));
    const dangerous = (hasCheckoutAction && (hasUnsafeInput || hasPullRequestHeadInput)) || hasGhCheckout || hasGitCheckout;
    if (!dangerous) continue;

    const combinationIntroduced = added.some((line) => targetTrigger.test(line)
      || checkoutAction.test(line)
      || unsafeCheckoutInput.test(line)
      || pullRequestHeadInput.test(line)
      || ghCheckout.test(line)
      || gitCheckout.test(line));
    if (!combinationIntroduced) continue;

    const reasons = [];
    if (hasUnsafeInput) reasons.push('unsafe checkout protection explicitly disabled');
    if (hasPullRequestHeadInput) reasons.push('checkout points at pull-request-controlled code');
    if (hasGhCheckout || hasGitCheckout) reasons.push('shell command checks out pull-request-controlled code');
    findings.push({
      path: file.filename,
      message: `pull_request_target combined with untrusted checkout: ${reasons.join('; ')}`
    });
  }
  return findings;
}

function waivedRuleIds(labels, config) {
  const waived = new Set();
  for (const label of labels) {
    for (const id of config.waiverLabels[label] || []) waived.add(id);
  }
  return waived;
}

function isDocsOnly(groups) {
  return groups.included.length > 0 && groups.included.every((file) => matchesAny(file.filename, groups.config?.paths?.docs || []));
}

export function analyzePullRequest(input, userConfig = {}, presetOverride = '') {
  const config = resolveConfig(userConfig, presetOverride);
  const pullRequest = input?.pullRequest || input?.pull_request || {};
  const files = (input?.files || []).map(cleanFile).filter((file) => file.filename);
  const groups = classify(files, config);
  groups.config = config;
  const title = String(pullRequest.title || '').trim();
  const body = String(pullRequest.body || '');
  const labels = normalizeLabels(pullRequest.labels);
  const waived = waivedRuleIds(labels, config);
  const skipLabel = labels.find((label) => config.skipLabels.includes(label));

  if (skipLabel) {
    return skippedReport(config, title, groups, `Skipped by label: ${skipLabel}`, labels);
  }
  if (pullRequest.draft && config.skipDrafts) {
    return skippedReport(config, title, groups, 'Skipped because this pull request is a draft.', labels);
  }

  const findings = [];
  const add = (finding) => {
    if (finding && !waived.has(finding.id)) findings.push(finding);
  };

  if (!title) {
    add(createFinding(config, 'missing-title', 'The pull request has no title.', [], 'Add a concise title that names the behavior or outcome.'));
  } else if (title.length < config.rules['short-title'].minLength) {
    add(createFinding(config, 'short-title', `The title is ${title.length} characters; the configured minimum is ${config.rules['short-title'].minLength}.`, [title], 'Describe the user-visible or maintainer-visible outcome.'));
  }

  if (pullRequest.draft) {
    add(createFinding(config, 'draft-pr', 'This pull request is marked as a draft.', [], 'Keep it draft until the checklist and tests are ready.'));
  }

  const minBody = Number(config.rules['thin-description'].minLength);
  if (body.trim().length < minBody) {
    add(createFinding(config, 'thin-description', `The body has ${body.trim().length} characters; the configured minimum is ${minBody}.`, [], 'Explain the problem, approach, testing, compatibility, and rollout risk.'));
  }

  const requiredSections = config.rules['required-sections'].sections || [];
  if (config.rules['required-sections'].level !== 'off' && requiredSections.length) {
    const present = headings(body);
    const missing = requiredSections.filter((section) => !present.some((heading) => heading === String(section).toLowerCase()));
    if (missing.length) {
      add(createFinding(config, 'required-sections', `Missing required section${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}.`, missing, 'Add the required Markdown headings and complete each section.'));
    }
  }

  if (config.rules['missing-issue-link'].level !== 'off' && !hasIssueLink(body)) {
    add(createFinding(config, 'missing-issue-link', 'No closing issue reference or GitHub issue URL was detected.', [], 'Add “Fixes #123” or a full GitHub issue URL.'));
  }

  const openTasks = uncheckedTasks(body);
  if (openTasks.length) {
    add(createFinding(config, 'unchecked-tasks', openTasks.length === 1 ? '1 unchecked checklist item remains.' : `${openTasks.length} unchecked checklist items remain.`, openTasks.slice(0, 6), 'Complete the checklist or explain why an item does not apply.'));
  }

  const changedLines = groups.included.reduce((sum, file) => sum + file.additions + file.deletions, 0);
  const manyFilesRule = config.rules['many-files'];
  if (groups.included.length > manyFilesRule.max) {
    add(createFinding(config, 'many-files', `${groups.included.length} files changed; the configured review target is ${manyFilesRule.max}.`, [], 'Split unrelated work or explain why the change must remain atomic.', dynamicLevel(manyFilesRule, groups.included.length, manyFilesRule.failAt)));
  }

  const largeDiffRule = config.rules['large-diff'];
  if (changedLines > largeDiffRule.max) {
    add(createFinding(config, 'large-diff', `${changedLines} lines changed; the configured review target is ${largeDiffRule.max}.`, [], 'Separate generated output, formatting, and unrelated refactors from behavior changes.', dynamicLevel(largeDiffRule, changedLines, largeDiffRule.failAt)));
  }

  const largeFileRule = config.rules['large-file'];
  const oversized = groups.included.filter((file) => file.additions + file.deletions > largeFileRule.max);
  if (oversized.length) {
    const largest = Math.max(...oversized.map((file) => file.additions + file.deletions));
    add(createFinding(config, 'large-file', `${oversized.length} file${oversized.length === 1 ? '' : 's'} exceed ${largeFileRule.max} changed lines.`, pathEvidence(oversized, 'large individual diff'), 'Split large files or document why the change is reviewable as one unit.', dynamicLevel(largeFileRule, largest, largeFileRule.failAt)));
  }

  const codeLines = groups.code.reduce((sum, file) => sum + file.additions + file.deletions, 0);
  const testLines = groups.tests.reduce((sum, file) => sum + file.additions + file.deletions, 0);
  const docsOnly = groups.included.length > 0 && groups.included.every((file) => matchesAny(file.filename, config.paths.docs));
  if (!docsOnly && groups.code.length > 0 && groups.tests.length === 0) {
    add(createFinding(config, 'missing-tests', `${groups.code.length} source file${groups.code.length === 1 ? '' : 's'} changed and no test file changed.`, pathEvidence(groups.code, 'source change'), 'Add focused tests or explain why existing coverage is sufficient.'));
  }

  const ratioRule = config.rules['low-test-ratio'];
  if (!docsOnly && codeLines >= ratioRule.minCodeLines && groups.tests.length > 0) {
    const ratio = codeLines ? testLines / codeLines : 0;
    if (ratio < ratioRule.minRatio) {
      add(createFinding(config, 'low-test-ratio', `Test changes are ${Math.round(ratio * 100)}% of source changes; the configured signal is ${Math.round(ratioRule.minRatio * 100)}%.`, [], 'Confirm that focused coverage exists for the changed behavior. This is a review signal, not a coverage metric.'));
    }
  }

  const removedTests = groups.tests.filter((file) => file.status === 'removed');
  if (removedTests.length) {
    add(createFinding(config, 'deleted-tests', `${removedTests.length} test file${removedTests.length === 1 ? '' : 's'} were removed.`, pathEvidence(removedTests, 'removed test'), 'Explain what replaces the deleted coverage.'));
  }

  if (!docsOnly && groups.code.length > 0 && groups.changelog.length === 0) {
    add(createFinding(config, 'missing-changelog', 'Source code changed but no configured changelog or changeset path changed.', [], 'Add a release note or mark the change as internal through a maintainer-controlled waiver label.'));
  }

  if (groups.dependencyManifest.length) {
    add(createFinding(config, 'dependency-change', `${groups.dependencyManifest.length} dependency manifest${groups.dependencyManifest.length === 1 ? '' : 's'} changed.`, pathEvidence(groups.dependencyManifest, 'dependency manifest'), 'Review install scripts, version ranges, licenses, lockfiles, and supply-chain impact.'));
    if (!groups.lockfile.length) {
      add(createFinding(config, 'manifest-without-lockfile', 'A dependency manifest changed without a detected lockfile update.', pathEvidence(groups.dependencyManifest, 'manifest without lockfile'), 'Confirm that the repository intentionally does not commit a lockfile, or update it.'));
    }
  }

  if (groups.sensitive.length) {
    add(createFinding(config, 'sensitive-change', `${groups.sensitive.length} security-sensitive path${groups.sensitive.length === 1 ? '' : 's'} changed.`, pathEvidence(groups.sensitive, 'sensitive path'), 'Request an owner familiar with authentication, permissions, workflows, or deployment risk.'));
  }

  const permissionRisks = findWorkflowPermissionRisks(groups.workflow);
  if (permissionRisks.length) {
    add(createFinding(config, 'workflow-permissions', 'New broad GitHub Actions write permissions were detected.', permissionRisks, 'Use the narrowest job-level permissions and document why each write permission is needed.'));
  }

  const unsafeTargetCheckouts = findUnsafePullRequestTargetCheckouts(groups.workflow);
  if (unsafeTargetCheckouts.length) {
    add(createFinding(config, 'unsafe-pr-target-checkout', unsafeTargetCheckouts.length === 1
      ? 'A pull_request_target workflow appears to check out pull-request-controlled code.'
      : `${unsafeTargetCheckouts.length} pull_request_target workflows appear to check out pull-request-controlled code.`,
    unsafeTargetCheckouts,
    'Do not execute fork code in pull_request_target. Keep privileged metadata/comment work there, and run builds in a separate pull_request workflow with a read-only token.'));
  }

  if (groups.credential.length) {
    add(createFinding(config, 'credential-file', `${groups.credential.length} likely credential or private-key file${groups.credential.length === 1 ? '' : 's'} changed.`, pathEvidence(groups.credential, 'credential-like path'), 'Remove secrets from Git history, rotate exposed credentials, and use a secret manager.'));
  }

  const secretMatches = findSecretMatches(groups.included);
  if (secretMatches.length) {
    add(createFinding(config, 'secret-pattern', `${secretMatches.length} high-confidence secret pattern${secretMatches.length === 1 ? '' : 's'} appeared in added lines. Values are intentionally not printed.`, secretMatches, 'Remove and rotate the credential before merging.'));
  }

  if (groups.migration.length) {
    add(createFinding(config, 'migration-change', `${groups.migration.length} migration or schema file${groups.migration.length === 1 ? '' : 's'} changed.`, pathEvidence(groups.migration, 'migration or schema'), 'Document rollback, compatibility, data volume, and deployment ordering.'));
  }

  if (groups.publicApi.length) {
    add(createFinding(config, 'public-api-change', `${groups.publicApi.length} likely public API file${groups.publicApi.length === 1 ? '' : 's'} changed.`, pathEvidence(groups.publicApi, 'public API surface'), 'Review backward compatibility, migration guidance, versioning, and release notes.'));
  }

  const generatedRule = config.rules['generated-heavy'];
  const generatedRatio = groups.included.length ? groups.generated.length / groups.included.length : 0;
  if (groups.generated.length >= generatedRule.minFiles && generatedRatio >= generatedRule.ratio) {
    add(createFinding(config, 'generated-heavy', `${Math.round(generatedRatio * 100)}% of changed files are classified as generated.`, pathEvidence(groups.generated.slice(0, 8), 'generated output'), 'Separate source changes from generated output where possible and document the regeneration command.'));
  }

  if (groups.binary.length) {
    add(createFinding(config, 'binary-change', `${groups.binary.length} binary artifact${groups.binary.length === 1 ? '' : 's'} changed.`, pathEvidence(groups.binary, 'binary artifact'), 'Provide provenance, checksums, source, and a reproducible build path.'));
  }

  const unpinned = findUnpinnedActions(groups.workflow, config.rules['unpinned-action'].exemptOwners);
  if (unpinned.length) {
    add(createFinding(config, 'unpinned-action', unpinned.length === 1 ? '1 newly added third-party Action reference is not pinned to a full commit SHA.' : `${unpinned.length} newly added third-party Action references are not pinned to a full commit SHA.`, unpinned, 'Pin third-party Actions to a reviewed 40-character commit SHA and retain a version comment.'));
  }

  const meaningful = groups.included.filter((file) => !matchesAny(file.filename, config.paths.docs));
  if (meaningful.length > 0 && meaningful.every((file) => matchesAny(file.filename, config.paths.lockfile))) {
    add(createFinding(config, 'lockfile-only', 'The non-documentation portion of this pull request changes only lockfiles.', pathEvidence(meaningful, 'lockfile'), 'Confirm the dependency update source and inspect transitive changes.'));
  }

  const visibleFindings = findings.filter((finding) => finding.level !== 'info');
  const score = Math.max(0, Math.round(100 - findings.reduce((sum, finding) => {
    const base = finding.level === 'fail' ? config.scoring.fail : finding.level === 'warn' ? config.scoring.warn : 0;
    return sum + base * finding.weight;
  }, 0)));
  const status = findings.some((finding) => finding.level === 'fail')
    ? 'fail'
    : visibleFindings.some((finding) => finding.level === 'warn') ? 'warn' : 'pass';

  return {
    schemaVersion: 1,
    tool: { name: 'PR Rigor', version: '1.1.0' },
    status,
    score,
    labels,
    waived: [...waived].sort(),
    summary: {
      title,
      changedFiles: groups.included.length,
      additions: groups.included.reduce((sum, file) => sum + file.additions, 0),
      deletions: groups.included.reduce((sum, file) => sum + file.deletions, 0),
      changedLines,
      codeFiles: groups.code.length,
      testFiles: groups.tests.length,
      codeLines,
      testLines,
      generatedRatio: Number(generatedRatio.toFixed(3)),
      docsOnly
    },
    findings,
    config
  };
}

function skippedReport(config, title, groups, reason, labels) {
  return {
    schemaVersion: 1,
    tool: { name: 'PR Rigor', version: '1.1.0' },
    status: 'skipped',
    score: 100,
    labels,
    waived: [],
    summary: {
      title,
      changedFiles: groups.included.length,
      additions: groups.included.reduce((sum, file) => sum + file.additions, 0),
      deletions: groups.included.reduce((sum, file) => sum + file.deletions, 0),
      changedLines: groups.included.reduce((sum, file) => sum + file.additions + file.deletions, 0),
      codeFiles: groups.code.length,
      testFiles: groups.tests.length,
      codeLines: groups.code.reduce((sum, file) => sum + file.additions + file.deletions, 0),
      testLines: groups.tests.reduce((sum, file) => sum + file.additions + file.deletions, 0),
      generatedRatio: 0,
      docsOnly: false,
      reason
    },
    findings: [],
    config
  };
}
