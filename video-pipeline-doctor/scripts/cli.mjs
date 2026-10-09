#!/usr/bin/env node
import { open } from 'node:fs/promises';
import { diagnose } from './diagnose.mjs';

const limit = 2 * 1024 * 1024;
async function readFile(path) {
  const handle = await open(path, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > limit) throw new Error('INVALID_INPUT');
    const buf = Buffer.alloc(limit + 1);
    const { bytesRead } = await handle.read(buf, 0, buf.length, 0);
    if (bytesRead > limit) throw new Error('INVALID_INPUT');
    return buf.subarray(0, bytesRead).toString('utf8').replace(/^\uFEFF/, '');
  } finally { await handle.close(); }
}
async function readStdin() {
  const parts = []; let size = 0;
  for await (const chunk of process.stdin) { size += chunk.length; if (size > limit) throw new Error('INVALID_INPUT'); parts.push(chunk); }
  return Buffer.concat(parts).toString('utf8');
}
const help = `Video Pipeline Doctor v0.1 (offline, no API key required)
Usage:
  node scripts/cli.mjs diagnose --log error.log [--workflow workflow.json] [--provider comfyui] [--json]
  node scripts/cli.mjs diagnose --response response.json --provider runway --json
  node scripts/cli.mjs diagnose --incident incident.json --json
  node scripts/cli.mjs diagnose --stdin --provider ffmpeg
Options: --log, --response, --workflow, --context, --provider, --incident, --stdin, --json
--stdin reads plain log text. --incident cannot be combined with other input options.
HTTP responses: {"http_status":503,"headers":{},"body":{...}}
Exit: 0 findings/no failure signal, 2 insufficient evidence, 64 invalid input.
No generation, retries, network, environment commands, or file writes are performed.`;

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help')) { console.log(help); return; }
  if (args.shift() !== 'diagnose') throw new Error('INVALID_ARGUMENT');
  const opts = {};
  while (args.length) {
    const flag = args.shift();
    if (!['--log','--response','--workflow','--context','--provider','--incident','--stdin','--json'].includes(flag) || flag in opts) throw new Error('INVALID_ARGUMENT');
    if (['--stdin','--json'].includes(flag)) opts[flag] = true;
    else { const v = args.shift(); if (!v || v.startsWith('--')) throw new Error('INVALID_ARGUMENT'); opts[flag] = v; }
  }
  if (opts['--incident'] && Object.keys(opts).some(k => !['--incident','--json'].includes(k))) throw new Error('INVALID_ARGUMENT');
  if (opts['--stdin'] && opts['--log']) throw new Error('INVALID_ARGUMENT');
  if (!['--log','--response','--incident','--stdin','--workflow'].some(k => opts[k])) throw new Error('INVALID_ARGUMENT');
  const incident = opts['--incident'] ? JSON.parse(await readFile(opts['--incident'])) : {};
  if (!opts['--incident']) {
    if (opts['--provider']) incident.provider = opts['--provider'];
    if (opts['--log']) incident.log = await readFile(opts['--log']);
    if (opts['--stdin']) incident.log = await readStdin();
    for (const field of ['response','workflow','context']) if (opts[`--${field}`]) incident[field] = JSON.parse(await readFile(opts[`--${field}`]));
  }
  const result = diagnose(incident);
  if (opts['--json']) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`VIDEO PIPELINE DOCTOR\nProvider: ${result.provider}\nCategory: ${result.primary_category}\nStage: ${result.stage ?? 'not established'}\nRetry: ${result.retry.decision}`);
    for (const f of result.findings) {
      console.log(`\n[${f.category}] ${f.cause}\nEvidence strength: ${f.confidence} (${f.confidence_basis})`);
      for (const e of f.evidence) console.log(`  Evidence: ${e.location} — ${e.observation}`);
      f.fixes.forEach((x,i) => console.log(`  ${i+1}. ${x}`));
      console.log(`  Verify: ${f.verify}`);
    }
    if (result.workflow.status === 'MATCHED') console.log(`\nNode ${result.workflow.failing_node}: upstream [${result.workflow.upstream}] / downstream [${result.workflow.downstream}]`);
    for (const n of result.notes) console.log(`\nNote: ${n}`);
    console.log('\nStatic evidence only. Nothing was executed or uploaded.');
  }
  process.exitCode = result.status === 'NEEDS_INFORMATION' ? 2 : 0;
}
main().catch(() => { console.error('Unable to diagnose: check arguments, readable local files, JSON structure and the 2 MiB input limit. Raw input and paths are withheld. Use --help.'); process.exitCode = 64; });
