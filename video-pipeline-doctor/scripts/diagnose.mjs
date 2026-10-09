import { signatures, providers } from './signatures.mjs';
import { inspectWorkflow } from './workflow.mjs';
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const text = x => typeof x === 'string' ? x : '';
const RUNWAY = 'https://docs.dev.runwayml.com/errors/task-failures/';
const FAL = 'https://fal.ai/docs/documentation/model-apis/errors';
const REPLICATE = 'https://replicate.com/docs/reference/how-does-replicate-work/';
const COMFY = 'https://docs.comfy.org/troubleshooting/overview';
const states = new Set(['starting','processing','succeeded','failed','canceled','cancelled','pending','running','throttled','in_queue','in_progress','completed']);
const active = new Set(['starting','processing','pending','running','throttled','in_queue','in_progress']);
const done = new Set(['succeeded','completed']);
const failure = new Set(['failed','canceled','cancelled']);
const rank = { DO_NOT_RETRY_AS_IS: 0, CHECK_STATUS_FIRST: 1, UNKNOWN: 2, RETRY_LATER: 3, NO_RETRY_NEEDED: 4 };

// Local text heuristics: inspect the context of each match, not every word on
// the line. Runtime errors often end with conditional troubleshooting advice.
function hasRuntimeSignature(line, pattern) {
  const message = line.replace(/^(?:\s*\[[^\]\r\n]{1,100}\]\s*)+/, '').trimStart();
  if (/^(?:for\s+example\b|example\b|hypothetical\b|if\b)/i.test(message)) return false;
  // Prompt payloads echoed by a logger are user content, even at ERROR level.
  const prompt = /(?:^|[\s{,])["']?(?:user[ _-]+)?(?:negative[ _-]+)?prompt["']?\s*[:=]/i.exec(line);
  for (const match of line.matchAll(new RegExp(pattern.source, `${pattern.flags.replace(/[gy]/g, '')}g`))) {
    if (prompt && match.index >= prompt.index) continue;
    const before = line.slice(Math.max(0, match.index - 160), match.index);
    const after = line.slice(match.index + match[0].length, match.index + match[0].length + 100);
    if (/\b(?:no|without|not|never)\s+(?:a\s+)?$/i.test(before)) continue;
    if (/^\s*["']?\s*[:=]\s*(?:false|0)\b/i.test(after)) continue;
    return true;
  }
  return false;
}

export function diagnose(incident = {}) {
  if (!object(incident) || (incident.log !== undefined && typeof incident.log !== 'string') ||
      (incident.response !== undefined && !object(incident.response)) ||
      (incident.context !== undefined && !object(incident.context)) ||
      !providers.includes(incident.provider ?? 'auto')) throw new Error('INVALID_INPUT');
  const r = incident.response ?? {}, body = object(r.body) ? r.body : r;
  const ctx = incident.context ?? {};
  const sources = [{ location: 'log', value: text(incident.log) }];
  const event = body.type === 'execution_error' && object(body.data) ? body.data : body;
  // Deliberate allowlist: never traverse input, prompt, headers, URLs, arbitrary metadata.
  for (const key of ['error','logs','failure','exception_message']) if (typeof event[key] === 'string') sources.push({ location: `response.${key}`, value: event[key] });
  const combined = sources.map(x => x.value).join('\n');
  if (combined.length > 2 * 1024 * 1024) throw new Error('INPUT_TOO_LARGE');
  const detected = new Set();
  if ('failureCode' in body) detected.add('runway');
  if (body.type === 'execution_error' || /\bComfyUI\b/i.test(combined) || incident.workflow !== undefined) detected.add('comfyui');
  if ((Array.isArray(body.detail) && body.detail.some(d => object(d) && /^https:\/\/(?:docs\.)?fal\.ai\//.test(text(d.url)))) || ('request_id' in body && ['IN_QUEUE','IN_PROGRESS','COMPLETED'].includes(body.status))) detected.add('fal');
  if ('version' in body && 'status' in body && ('logs' in body || 'model' in body)) detected.add('replicate');
  if (/\bffmpeg version\b/i.test(combined)) detected.add('ffmpeg');
  const explicit = incident.provider && incident.provider !== 'auto';
  const provider = explicit ? incident.provider : detected.size === 1 ? [...detected][0] : 'unknown';
  const notes = [];
  if (!explicit && detected.size > 1) notes.push('Multiple source signals: provider is ambiguous; pass --provider for the failing service.');
  if (provider === 'unknown') notes.push('Provider is not established; generic signatures do not identify a service.');
  const rawState = text(body.status).toLowerCase();
  const state = states.has(rawState) ? rawState : 'unknown';
  const statusValue = r.http_status ?? r.statusCode ?? (typeof r.status === 'number' ? r.status : undefined);
  const http = Number.isInteger(statusValue) && statusValue >= 100 && statusValue <= 599 ? statusValue : null;
  const headers = object(r.headers) ? r.headers : {};
  const retryHeader = Object.entries(headers).find(([k]) => k.toLowerCase() === 'x-fal-needs-retry')?.[1];
  const falRetry = retryHeader === true || retryHeader === 'true' ? true : retryHeader === false || retryHeader === 'false' ? false : null;
  const findings = [];
  const add = (id, category, cause, retry, location, evidence, fixes, stage = null, basis = 'structured', source = null, verify = 'Check the original job outcome and verify the proposed change before an approved retry.') => {
    if (findings.some(x => x.id === id)) return;
    findings.push({ id, category, stage, cause, confidence: basis === 'structured' ? 'strong' : 'moderate', confidence_basis: basis,
      evidence: [{ location, observation: evidence }], retry, fixes, verify, source });
  };
  const no = 'DO_NOT_RETRY_AS_IS';
  const transient = failure.has(state) ? 'RETRY_LATER' : 'CHECK_STATUS_FIRST';
  if ([401,403,402].includes(http)) add('http-auth', 'AUTH_QUOTA', 'Authentication, authorization or billing rejected the request.', no, 'response.http_status', `HTTP ${http}`, ['Check credentials, permissions and balance privately; do not print keys.'], 'REQUEST');
  if (http === 429) add('http-rate', 'AUTH_QUOTA', 'The service rejected the request due to a request/quota limit.', 'RETRY_LATER', 'response.http_status', 'HTTP 429', ['Check rate limits versus hard quota/billing limits.', 'Honor Retry-After or documented backoff; reconcile the original job first.'], 'REQUEST');
  if ([500,502,503,504].includes(http)) add('http-server', 'PROVIDER_UNAVAILABLE', 'A server or gateway error was observed; generation outcome may be unknown.', transient, 'response.http_status', `HTTP ${http}`, ['Check the original job status before creating another job.', 'Use bounded delayed retries only when the provider permits them.'], 'REQUEST');
  if ([400,422].includes(http)) add('http-input', 'INPUT_INVALID', 'The request was rejected as invalid; the specific field needs inspection.', no, 'response.http_status', `HTTP ${http}`, ['Compare the request against the exact endpoint schema. A validation error alone does not prove a model update.'], 'INPUT');
  if (provider === 'runway') {
    const code = text(body.failureCode);
    if (/^SAFETY\./.test(code) || code === 'INPUT_PREPROCESSING.SAFETY.TEXT') add('runway-safety', 'SAFETY', 'Runway reports a moderation rejection.', no, 'response.failureCode', 'Recognized safety failure code.', ['Do not repeat or evade moderation. Review the policy or contact support for a suspected mistake.'], 'MODERATION', 'structured', RUNWAY);
    else if (code === 'ASSET.INVALID') add('runway-asset', 'INPUT_INVALID', 'Runway rejected an input asset.', no, 'response.failureCode', 'ASSET.INVALID', ['Check input dimensions, duration and format against the selected model.'], 'INPUT', 'structured', RUNWAY);
    else if (code.startsWith('INTERNAL.BAD_OUTPUT.')) add('runway-output', 'QUALITY_FAILURE', 'Runway rejected the generated output for quality or system reasons.', no, 'response.failureCode', 'Recognized bad-output failure code.', ['Inspect input and prompt suitability; do not claim to have visually inspected the output.', 'Review corrections before authorizing another paid job.'], 'GENERATION', 'structured', RUNWAY);
    else if (['THIRD_PARTY.UNAVAILABLE','INPUT_PREPROCESSING.INTERNAL','INTERNAL'].includes(code) || (state === 'failed' && body.failureCode === null)) add('runway-transient', 'PROVIDER_UNAVAILABLE', 'Runway reports an internal or upstream failure.', transient, 'response.failureCode', 'Recognized internal/upstream failure.', ['Wait and check provider guidance; limit retries and costs.'], 'GENERATION', 'structured', RUNWAY);
  }
  if (provider === 'fal') {
    const details = Array.isArray(body.detail) ? body.detail : [];
    if (details.length > 1000) throw new Error('INPUT_TOO_LARGE');
    const types = details.map((d,i) => ({ type: object(d) ? text(d.type) : '', location: `response.detail[${i}].type` }));
    if (typeof body.error_type === 'string') types.push({ type: body.error_type, location: 'response.error_type' });
    for (const { type, location } of types) {
      if (!type) continue;
      if (type === 'content_policy_violation') add('fal-safety', 'SAFETY', 'fal reports a content-policy rejection.', no, location, 'Recognized content-policy type.', ['Do not repeat or bypass moderation; review policy or request support.'], 'MODERATION', 'structured', FAL);
      else if (['generation_timeout','startup_timeout','runner_connection_timeout'].includes(type)) add('fal-timeout', 'QUEUE_TIMEOUT', 'fal reports a processing or infrastructure timeout.', falRetry === true ? transient : falRetry === false ? no : 'UNKNOWN', location, 'Recognized timeout type.', ['Reconcile the original request and inspect provider retry guidance.'], null, 'structured', FAL);
      else if (['internal_server_error','downstream_service_error','downstream_service_unavailable','internal_error','runner_server_error','runner_connection_refused','runner_connection_error','runner_incomplete_response'].includes(type)) add('fal-server', 'PROVIDER_UNAVAILABLE', 'fal reports an infrastructure or downstream error.', falRetry === true ? transient : falRetry === false ? no : 'UNKNOWN', location, 'Recognized infrastructure type.', ['Check request status and X-Fal-Needs-Retry before authorizing a bounded retry.'], null, 'structured', FAL);
      else if (['client_disconnected','client_cancelled'].includes(type)) add('fal-client', 'UNKNOWN', 'The client disconnected or canceled; do not assume generation failed.', 'CHECK_STATUS_FIRST', location, 'Recognized client interruption type.', ['Inspect the original request outcome; do not create a duplicate generation.'], 'REQUEST', 'structured', FAL);
      else if (http === 422 || details.some(d => object(d) && d.type === type)) add('fal-input', 'INPUT_INVALID', 'fal reports an input validation error.', no, location, 'Typed model validation error.', ['Inspect the field locally and compare with the endpoint schema; messages and input values are withheld from this report.'], 'INPUT', 'structured', FAL);
    }
  }
  for (const src of sources) {
    const lines = src.value.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const s of signatures) if (hasRuntimeSignature(line, s.pattern)) {
        if (s.id.startsWith('ffmpeg-') && provider !== 'ffmpeg' && !/\bffmpeg\b/i.test(combined)) continue;
        add(s.id, s.category, s.cause, no, `${src.location}:line:${i+1}`, `Matched local signature ${s.id}; raw text withheld.`, s.fixes, s.stage, 'signature', s.category === 'VRAM_OOM' && provider === 'comfyui' ? COMFY : null, s.verify);
      }
    }
  }
  // Positive, explicit metadata only. Version changes alone never establish drift.
  if (ctx.schema_change_confirmed === true && findings.some(f => f.category === 'INPUT_INVALID')) add('schema-change', 'MODEL_SCHEMA_DRIFT', 'The caller reports a confirmed schema change alongside input rejection; independently verify it.', no, 'context.schema_change_confirmed', 'Caller supplied true; not independently verified.', ['Compare pinned before/after API schemas and the failing parameter.'], 'INPUT', 'caller');
  if (active.has(state) && Number.isFinite(ctx.elapsed_seconds) && Number.isFinite(ctx.deadline_seconds) && ctx.elapsed_seconds >= 0 && ctx.deadline_seconds > 0 && ctx.elapsed_seconds > ctx.deadline_seconds) add('deadline-exceeded', 'QUEUE_TIMEOUT', 'The caller-supplied elapsed time exceeds its deadline; the job may still be running.', 'CHECK_STATUS_FIRST', 'context.elapsed_seconds/deadline_seconds', 'Caller supplied elapsed time exceeds its deadline.', ['Check the original job before any cancellation or new submission.'], 'QUEUE', 'caller');
  const graph = inspectWorkflow(incident.workflow, event.node_id ?? ctx.failing_node_id);
  if (graph.status === 'INVALID') notes.push('Workflow is unsupported, malformed, oversized or has broken node references; graph results withheld.');
  if (graph.status === 'MATCHED') for (const f of findings) if (f.stage === null && f.category === 'VRAM_OOM') f.stage = graph.stage;
  if (graph.status === 'NODE_NOT_IDENTIFIED') notes.push('No verified failing node could be matched to this workflow.');
  findings.sort((a,b) => rank[a.retry] - rank[b.retry] || (a.category === 'SAFETY' ? -1 : b.category === 'SAFETY' ? 1 : 0));
  let decision = findings[0]?.retry ?? (active.has(state) ? 'CHECK_STATUS_FIRST' : done.has(state) ? 'NO_RETRY_NEEDED' : 'UNKNOWN');
  if (provider === 'fal' && falRetry === false && findings.length) decision = no;
  if (provider === 'fal' && falRetry === null && decision === 'RETRY_LATER' && findings.some(f => ['PROVIDER_UNAVAILABLE','QUEUE_TIMEOUT'].includes(f.category))) decision = 'UNKNOWN';
  if (active.has(state) && decision === 'RETRY_LATER') decision = 'CHECK_STATUS_FIRST';
  if (done.has(state) && findings.length) { notes.push('A completed status coexists with error evidence. Verify timestamps and pipeline stage; this may be a historical log or downstream failure.'); if (decision === 'RETRY_LATER') decision = 'CHECK_STATUS_FIRST'; }
  // Findings expose effective retry advice for this incident, never a more
  // permissive isolated HTTP hint. Keep evidence priority/category ordering.
  let restricted = false;
  for (const finding of findings) {
    if (rank[finding.retry] > rank[decision]) {
      finding.retry = decision;
      restricted = true;
    }
  }
  if (restricted) notes.push('Per-finding retry advice is restricted by the overall incident policy, including provider hints and job state.');
  if (!findings.length) notes.push('No recognized failure signature. This is not proof that the pipeline is healthy.');
  if (failure.has(state) && !findings.length) notes.push('Terminal failure/cancellation is present but its cause cannot be determined.');
  if (provider === 'fal' && falRetry === null && findings.some(f => ['PROVIDER_UNAVAILABLE','QUEUE_TIMEOUT'].includes(f.category))) notes.push('fal retry header unavailable; do not infer permission to retry from HTTP status alone.');
  const insufficient = ['Exact failing operation and timestamp', 'Redacted error and terminal job status', 'Model/node versions and recent changes'];
  if (findings.some(f => f.category === 'VRAM_OOM')) insufficient.push('GPU model, VRAM, input dimensions/frame count, and comparable peak-memory measurements');
  return { schema_version: '1.0', tool_version: '0.1.0', provider,
    status: findings.length ? 'FINDINGS' : 'NEEDS_INFORMATION', observed_state: state, http_status: http,
    primary_category: findings[0]?.category ?? 'UNKNOWN', stage: findings[0]?.stage ?? null,
    retry: { decision, automatic_execution: false, guidance: decision === no ? 'Do not retry unchanged. Review the specific fix; generation is never executed by this tool.' : decision === 'NO_RETRY_NEEDED' ? 'Response reports completion; verify output and downstream stages.' : 'Reconcile the original job first. Retry only with provider permission, explicit approval, and a bounded cost/attempt limit.' },
    workflow: graph, findings, missing_information: insufficient, notes,
    limitations: ['Static single-incident analysis; no live status or environment collection.', 'Confidence labels describe evidence strength, not statistical probabilities.', 'No estimated VRAM savings or automatic version-regression attribution.', 'Raw logs, prompts, model names, URLs, credentials and arbitrary node labels are never echoed.'],
    references: [...new Set(findings.map(f => f.source).filter(Boolean).concat(provider === 'replicate' ? [REPLICATE] : []))] };
}
