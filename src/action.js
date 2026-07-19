import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { analyzePullRequest } from './analyze.js';
import { renderMarkdown } from './render.js';
import { renderSarif } from './sarif.js';
import { fetchPullFiles, fetchRepositoryJson, upsertComment } from './github.js';

function input(name, fallback = '') {
  return process.env[`INPUT_${name.toUpperCase().replaceAll('-', '_')}`] || fallback;
}

function boolInput(name, fallback) {
  const value = input(name, String(fallback)).trim().toLowerCase();
  return !['false', '0', 'no', 'off'].includes(value);
}

function workflowEscape(value) {
  return String(value).replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
}

function propertyEscape(value) {
  return workflowEscape(value).replaceAll(':', '%3A').replaceAll(',', '%2C');
}

async function append(file, text) {
  if (file) await fs.appendFile(file, text, 'utf8');
}

async function setOutputs(values) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) return;
  for (const [key, value] of Object.entries(values)) {
    const delimiter = `PR_RIGOR_${key}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    await append(file, `${key}<<${delimiter}\n${String(value)}\n${delimiter}\n`);
  }
}

function annotationCommand(level) {
  return level === 'fail' ? 'error' : level === 'warn' ? 'warning' : 'notice';
}

function emitAnnotations(report) {
  let emitted = 0;
  for (const finding of report.findings) {
    for (const evidence of finding.evidence) {
      if (emitted >= 20) return;
      const file = typeof evidence === 'object' ? evidence.path : '';
      if (!file || String(file).startsWith('...')) continue;
      const title = workflowEscape(`PR Rigor: ${finding.title}`);
      const message = workflowEscape(`${finding.detail} ${finding.suggestion || ''}`.trim());
      console.log(`::${annotationCommand(finding.level)} file=${propertyEscape(file)},title=${propertyEscape(title)}::${message}`);
      emitted += 1;
    }
  }
}

async function loadConfig(event, owner, repo, token) {
  const inline = input('config-json').trim();
  if (inline) {
    try {
      return JSON.parse(inline);
    } catch (error) {
      throw new Error(`config-json is invalid JSON: ${error.message}`);
    }
  }
  const configPath = input('config', '.pr-rigor.json').trim();
  if (!configPath) return {};
  const ref = event.pull_request?.base?.sha || event.after || event.repository?.default_branch;
  return fetchRepositoryJson(owner, repo, configPath, ref, token);
}

async function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) throw new Error('GITHUB_EVENT_PATH is not set.');
  const event = JSON.parse(await fs.readFile(eventPath, 'utf8'));
  const pullRequest = event.pull_request;
  if (!pullRequest) throw new Error('PR Rigor must run on pull_request or pull_request_target.');

  const repository = event.repository?.full_name || process.env.GITHUB_REPOSITORY;
  if (!repository?.includes('/')) throw new Error('Could not determine the GitHub repository.');
  const [owner, repo] = repository.split('/');
  const number = Number(event.number || pullRequest.number);
  const token = input('token', process.env.GITHUB_TOKEN || '');
  const config = await loadConfig(event, owner, repo, token);
  const files = await fetchPullFiles(owner, repo, number, token);
  const report = analyzePullRequest({ pullRequest, files }, config, input('preset'));
  const markdown = renderMarkdown(report);

  if (boolInput('summary', true)) await append(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
  if (boolInput('annotations', true)) emitAnnotations(report);

  const sarifOutput = input('sarif-output').trim();
  if (sarifOutput) {
    await fs.mkdir(path.dirname(path.resolve(sarifOutput)), { recursive: true });
    await fs.writeFile(sarifOutput, `${JSON.stringify(renderSarif(report), null, 2)}\n`, 'utf8');
  }

  if (boolInput('comment', true)) {
    try {
      await upsertComment(owner, repo, number, token, markdown);
    } catch (error) {
      console.log(`::warning title=PR Rigor comment not posted::${workflowEscape(error.message)}`);
    }
  }

  await setOutputs({
    status: report.status,
    score: report.score,
    findings: report.findings.length,
    report: markdown,
    sarif: sarifOutput
  });

  console.log(markdown);
  if (boolInput('fail-on-error', true) && report.status === 'fail') process.exitCode = 1;
}

main().catch((error) => {
  console.error(`::error title=PR Rigor failed::${workflowEscape(error.message)}`);
  process.exitCode = 1;
});
