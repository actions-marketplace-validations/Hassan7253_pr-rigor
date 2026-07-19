function icon(level) {
  return { pass: '✅', info: 'ℹ️', warn: '⚠️', fail: '🛑', skipped: '⏭️' }[level] || '•';
}

function escapeTable(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function evidenceLabel(item) {
  if (typeof item === 'string') return item;
  if (item?.path && item?.message) return `${item.path} — ${item.message}`;
  return item?.path || item?.message || JSON.stringify(item);
}

export function renderMarkdown(report) {
  const lines = [
    '<!-- pr-rigor-report -->',
    '## PR Rigor report',
    ''
  ];

  if (report.status === 'skipped') {
    lines.push(`**Status:** ${icon('skipped')} SKIPPED`, '', report.summary.reason || 'This pull request was skipped by policy.', '');
    return lines.join('\n');
  }

  lines.push(
    `**Status:** ${icon(report.status)} ${report.status.toUpperCase()} &nbsp; **Readiness score:** ${report.score}/100`,
    '',
    `Changed files: **${report.summary.changedFiles}** · Lines: **+${report.summary.additions} / -${report.summary.deletions}** · Source: **${report.summary.codeFiles}** · Tests: **${report.summary.testFiles}**`,
    ''
  );

  if (report.findings.length === 0) {
    lines.push('No configured readiness risks were detected.', '');
  } else {
    lines.push('| Category | Check | Result | Detail |', '|---|---|---:|---|');
    for (const item of report.findings) {
      lines.push(`| ${escapeTable(item.category)} | ${escapeTable(item.title)} | ${icon(item.level)} ${item.level.toUpperCase()} | ${escapeTable(item.detail)} |`);
    }
  }

  for (const item of report.findings.filter((entry) => entry.evidence.length || entry.suggestion)) {
    lines.push('', `<details><summary>${icon(item.level)} ${escapeTable(item.title)}</summary>`, '');
    if (item.evidence.length) {
      lines.push('**Evidence**');
      for (const evidence of item.evidence.slice(0, 12)) {
        lines.push(`- \`${evidenceLabel(evidence).replaceAll('`', '\\`')}\``);
      }
      if (item.evidence.length > 12) lines.push(`- ...and ${item.evidence.length - 12} more`);
      lines.push('');
    }
    if (item.suggestion) lines.push(`**Next step:** ${item.suggestion}`, '');
    lines.push('</details>');
  }

  if (report.waived.length) {
    lines.push('', `<details><summary>Maintainer waivers (${report.waived.length})</summary>`, '');
    for (const id of report.waived) lines.push(`- \`${id}\``);
    lines.push('', '</details>');
  }

  lines.push('', '> Deterministic signals reduce review setup time. They do not decide whether a change is correct or should be merged.', '');
  return lines.join('\n');
}

export function renderText(report) {
  if (report.status === 'skipped') return `SKIPPED: ${report.summary.reason || 'policy'}`;
  const lines = [
    `Status: ${report.status.toUpperCase()}  Score: ${report.score}/100`,
    `Files: ${report.summary.changedFiles}  Lines: +${report.summary.additions}/-${report.summary.deletions}`
  ];
  for (const item of report.findings) lines.push(`${icon(item.level)} [${item.level.toUpperCase()}] ${item.title}: ${item.detail}`);
  return lines.join('\n');
}
