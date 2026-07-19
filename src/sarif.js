function sarifLevel(level) {
  return level === 'fail' ? 'error' : level === 'warn' ? 'warning' : 'note';
}

function locationFromEvidence(evidence) {
  const item = evidence.find((value) => typeof value === 'object' && value?.path && !String(value.path).startsWith('...'));
  if (!item) return [];
  return [{
    physicalLocation: {
      artifactLocation: { uri: item.path, uriBaseId: '%SRCROOT%' },
      region: { startLine: 1 }
    }
  }];
}

export function renderSarif(report) {
  const ruleIds = [...new Set(report.findings.map((finding) => finding.id))];
  const rules = ruleIds.map((id) => {
    const finding = report.findings.find((item) => item.id === id);
    return {
      id,
      name: id.replaceAll('-', '_'),
      shortDescription: { text: finding.title },
      fullDescription: { text: finding.detail },
      help: { text: finding.suggestion || finding.detail },
      defaultConfiguration: { level: sarifLevel(finding.level) },
      properties: { category: finding.category, tags: ['maintainability', 'pull-request'] }
    };
  });

  const results = report.findings.map((finding) => ({
    ruleId: finding.id,
    level: sarifLevel(finding.level),
    message: { text: `${finding.detail}${finding.suggestion ? ` Next step: ${finding.suggestion}` : ''}` },
    locations: locationFromEvidence(finding.evidence),
    properties: { category: finding.category, readinessScore: report.score }
  }));

  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: report.tool?.name || 'PR Rigor',
          version: report.tool?.version || '1.0.0',
          informationUri: 'https://github.com/Hassan7253/pr-rigor',
          rules
        }
      },
      results
    }]
  };
}
