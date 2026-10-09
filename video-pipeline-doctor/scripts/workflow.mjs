const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const idOf = x => /^(0|[1-9]\d{0,9})$/.test(String(x)) ? String(x) : null;
export function inspectWorkflow(workflow, failingId) {
  if (workflow === undefined) return { status: 'NOT_PROVIDED', failing_node: null, upstream: [], downstream: [], stage: null };
  const empty = { status: 'INVALID', failing_node: null, upstream: [], downstream: [], stage: null };
  if (!object(workflow)) return empty;
  const nodes = new Map(), edges = [];
  let invalid = false;
  const add = (id, type) => {
    id = idOf(id);
    if (id === null || nodes.has(id) || typeof type !== 'string' || type.length > 200) { invalid = true; return; }
    nodes.set(id, type);
  };
  if (Array.isArray(workflow.nodes)) {
    if (workflow.nodes.length > 10000 || !Array.isArray(workflow.links) || workflow.links.length > 50000) return empty;
    for (const n of workflow.nodes) { if (!object(n)) return empty; add(n.id, n.type); }
    for (const l of workflow.links) {
      if (!Array.isArray(l) || l.length < 6 || idOf(l[1]) === null || idOf(l[3]) === null) return empty;
      edges.push([String(l[1]), String(l[3])]);
    }
  } else {
    const prompt = object(workflow.prompt) ? workflow.prompt : workflow;
    const entries = Object.entries(prompt);
    if (!entries.length || entries.length > 10000) return empty;
    for (const [id, n] of entries) { if (!object(n) || !object(n.inputs)) return empty; add(id, n.class_type); }
    for (const [id, n] of entries) for (const v of Object.values(n.inputs)) {
      if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' && idOf(v[0]) !== null && Number.isInteger(v[1]) && v[1] >= 0) {
        edges.push([String(v[0]), id]);
      }
      if (edges.length > 50000) return empty;
    }
  }
  if (invalid || edges.some(([a,b]) => !nodes.has(a) || !nodes.has(b))) return empty;
  const id = idOf(failingId);
  if (id === null || !nodes.has(id)) return { ...empty, status: 'NODE_NOT_IDENTIFIED' };
  const type = nodes.get(id);
  // Only known class names become stages. Custom names are not echoed or guessed.
  const stages = new Map(Object.entries({ VAEEncode: 'VAE_ENCODE', VAEEncodeTiled: 'VAE_ENCODE', VAEDecode: 'VAE_DECODE', VAEDecodeTiled: 'VAE_DECODE', KSampler: 'GENERATION', KSamplerAdvanced: 'GENERATION' }));
  const stage = stages.get(type) ?? null;
  return { status: 'MATCHED', failing_node: id,
    upstream: [...new Set(edges.filter(([,b]) => b === id).map(([a]) => a))].sort(),
    downstream: [...new Set(edges.filter(([a]) => a === id).map(([,b]) => b))].sort(), stage };
}
