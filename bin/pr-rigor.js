#!/usr/bin/env node
import fs from 'node:fs/promises';
import process from 'node:process';
import { analyzePullRequest } from '../src/analyze.js';
import { configTemplate, listRules, resolveConfig } from '../src/config.js';
import { fetchPullFiles, fetchPullRequest } from '../src/github.js';
import { renderMarkdown, renderText } from '../src/render.js';
import { renderSarif } from '../src/sarif.js';

function parseArgs(argv) {
  const result = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) {
      result._.push(value);
      continue;
    }
    const [rawKey, inline] = value.slice(2).split(/=(.*)/s, 2);
    if (rawKey.startsWith('no-')) {
      result[rawKey.slice(3)] = false;
      continue;
    }
    if (inline !== undefined) {
      result[rawKey] = inline;
      continue;
    }
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) result[rawKey] = true;
    else {
      result[rawKey] = next;
      index += 1;
    }
  }
  return result;
}

function help() {
  console.log(`PR Rigor — deterministic pull-request readiness and supply-chain checks

Usage:
  pr-rigor init [--preset balanced|strict|library|docs] [--force]
  pr-rigor validate [--config .pr-rigor.json] [--preset PRESET]
  pr-rigor analyze --event event.json --files files.json [options]
  pr-rigor github OWNER/REPO#NUMBER [options]
  pr-rigor rules [RULE_ID]
  pr-rigor presets
  pr-rigor version

Options:
  --config FILE              Configuration file (default: .pr-rigor.json)
  --preset NAME              Override the configured preset
  --format markdown|text|json|sarif
  --output FILE              Write output to a file instead of stdout
  --token TOKEN              GitHub token; defaults to GITHUB_TOKEN
  --no-exit-code             Do not return exit code 1 for blocking findings

Examples:
  pr-rigor init --preset library
  pr-rigor validate
  pr-rigor analyze --event examples/event.json --files examples/files.json
  GITHUB_TOKEN=... pr-rigor github octocat/hello-world#42 --format json
`);
}

async function readJson(file, label) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read ${label} at ${file}: ${error.message}`);
  }
}

async function loadConfig(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw new Error(`Cannot read configuration at ${file}: ${error.message}`);
  }
}

function normalizeRepository(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(?:https?:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:#|\/pull\/)(\d+)$/i);
  if (!match) throw new Error('Expected OWNER/REPO#NUMBER or a GitHub pull-request URL.');
  return { owner: match[1], repo: match[2], number: Number(match[3]) };
}

function serialize(report, format) {
  if (format === 'json') return `${JSON.stringify(report, null, 2)}\n`;
  if (format === 'sarif') return `${JSON.stringify(renderSarif(report), null, 2)}\n`;
  if (format === 'text') return `${renderText(report)}\n`;
  if (format !== 'markdown') throw new Error('format must be markdown, text, json, or sarif.');
  return `${renderMarkdown(report)}\n`;
}

async function writeOutput(content, output) {
  if (output) {
    await fs.writeFile(output, content, 'utf8');
    console.error(`Wrote ${output}`);
  } else {
    process.stdout.write(content);
  }
}

async function runReport(report, args) {
  await writeOutput(serialize(report, args.format || 'markdown'), args.output);
  if (args['exit-code'] !== false && report.status === 'fail') process.exitCode = 1;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  if (!command || command === 'help' || args.help) {
    help();
    return;
  }

  if (command === 'version' || args.version) {
    console.log('1.0.0');
    return;
  }

  if (command === 'presets') {
    console.log('balanced\nstrict\nlibrary\ndocs');
    return;
  }

  if (command === 'rules') {
    const id = args._[1];
    const rules = listRules();
    if (id) {
      const rule = rules.find((item) => item.id === id);
      if (!rule) throw new Error(`Unknown rule: ${id}`);
      console.log(`${rule.id}\nCategory: ${rule.category}\n${rule.description}`);
    } else {
      for (const rule of rules) console.log(`${rule.id.padEnd(28)} ${rule.category.padEnd(15)} ${rule.description}`);
    }
    return;
  }

  if (command === 'init') {
    const target = String(args.config || '.pr-rigor.json');
    const preset = String(args.preset || 'balanced');
    try {
      await fs.writeFile(target, configTemplate(preset), { flag: args.force ? 'w' : 'wx' });
      console.log(`Created ${target} with the ${preset} preset.`);
    } catch (error) {
      if (error.code === 'EEXIST') throw new Error(`${target} already exists. Use --force to replace it.`);
      throw error;
    }
    return;
  }

  if (command === 'validate') {
    const configFile = String(args.config || '.pr-rigor.json');
    const config = await loadConfig(configFile);
    const resolved = resolveConfig(config, String(args.preset || ''));
    console.log(`Valid configuration. Preset: ${resolved.preset}. Rules: ${Object.keys(resolved.rules).length}.`);
    return;
  }

  if (command === 'analyze') {
    if (!args.event || !args.files) throw new Error('analyze requires --event and --files.');
    const event = await readJson(args.event, 'event');
    const filesPayload = await readJson(args.files, 'files');
    const files = Array.isArray(filesPayload) ? filesPayload : filesPayload.files;
    if (!Array.isArray(files)) throw new Error('The files document must be an array or contain a files array.');
    const config = await loadConfig(String(args.config || '.pr-rigor.json'));
    const report = analyzePullRequest({ pullRequest: event.pull_request || event, files }, config, String(args.preset || ''));
    await runReport(report, args);
    return;
  }

  if (command === 'github') {
    const reference = args._[1];
    if (!reference) throw new Error('github requires OWNER/REPO#NUMBER or a PR URL.');
    const { owner, repo, number } = normalizeRepository(reference);
    const token = String(args.token || process.env.GITHUB_TOKEN || '');
    const [pullRequest, files] = await Promise.all([
      fetchPullRequest(owner, repo, number, token),
      fetchPullFiles(owner, repo, number, token)
    ]);
    const config = await loadConfig(String(args.config || '.pr-rigor.json'));
    const report = analyzePullRequest({ pullRequest, files }, config, String(args.preset || ''));
    await runReport(report, args);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(`pr-rigor: ${error.message}`);
  process.exitCode = 1;
});
