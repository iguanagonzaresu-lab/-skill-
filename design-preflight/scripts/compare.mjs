import { readFileSync,statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const layout=['x','y','width','height','padding_top','padding_right','padding_bottom','padding_left','row_gap','column_gap'];
const typography=['font_size','font_weight','line_height','letter_spacing'];
const colors=['background_color','text_color','border_color'];
const contextKeys=['width','height','dpr','theme','state','coordinate_space'];
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const text=v=>typeof v==='string'&&v.length>0&&v.length<=1000&&!/[\u0000-\u001f\u007f]/.test(v);
const finite=v=>typeof v==='number'&&Number.isFinite(v);
export function validateSnapshot(s,side) {
  if(!plain(s)||s.schema_version!==1||!plain(s.source)||!plain(s.context)||!Array.isArray(s.elements)||s.elements.length>1000) throw new Error('Invalid snapshot');
  const kinds=side==='design'?['figma','manual','synthetic']:['browser','manual','synthetic'];
  if(!kinds.includes(s.source.kind)||!text(s.source.reference)) throw new Error('Invalid provenance');
  for(const k of ['width','height','dpr']) if(!finite(s.context[k])||s.context[k]<=0) throw new Error('Invalid context');
  for(const k of ['theme','state']) if(!text(s.context[k])) throw new Error('Invalid context');
  if(s.context.coordinate_space!=='frame-css-px') throw new Error('Unsupported coordinate space');
  const ids=new Set();
  for(const e of s.elements) {
    if(!plain(e)||!text(e.id)||!text(e.selector)||!plain(e.properties)||Object.keys(e.properties).length>100||ids.has(e.id)) throw new Error('Invalid element');
    ids.add(e.id);
    if(side==='actual'&&(!Number.isInteger(e.matches)||e.matches<0||typeof e.visible!=='boolean'||typeof e.fonts_ready!=='boolean')) throw new Error('Invalid capture flags');
  }
  return s;
}
const ruleFor=p=>layout.includes(p)?'Layout':typography.includes(p)?'Typography':colors.includes(p)?'Color':null;
function numberOK(p,v) {
  if(!finite(v)) return false;
  if(['x','y','letter_spacing'].includes(p)) return true;
  if(p==='font_weight') return v>=1&&v<=1000;
  if(['font_size','line_height'].includes(p)) return v>0;
  return v>=0;
}
const rgba=v=>Array.isArray(v)&&v.length===4&&v.every(finite)&&v.slice(0,3).every(n=>n>=0&&n<=255)&&v[3]>=0&&v[3]<=1;
export function measurement(property,expected,actual) {
  const rule=ruleFor(property);if(!rule) return null;
  let delta,tolerance;
  if(rule==='Color') {
    if(!rgba(expected)||!rgba(actual)) return null;
    delta=expected[3]===0&&actual[3]===0?0:Math.max(...expected.map((v,i)=>Math.abs(v-actual[i])*(i===3?255:1)));
    tolerance=2;
  } else {
    if(!numberOK(property,expected)||!numberOK(property,actual)) return null;
    delta=Math.abs(expected-actual);tolerance=rule==='Layout'?1:property==='font_weight'?0:.5;
  }
  return {rule,delta:Number(delta.toFixed(6)),tolerance,status:delta<=tolerance+1e-9?'PASS':'FAIL'};
}
export function compare(design,actual) {
  validateSnapshot(design,'design');validateSnapshot(actual,'actual');
  const r={schema_version:1,status:'WARN',scope:'declared normalized properties only; input provenance not independently verified',
    sources:{design:design.source,actual:actual.source},context:design.context,compared_properties:0,passed_properties:0,findings:[],
    limitations:['No live Figma extraction or browser capture performed by this CLI.',
      'Shape, content, token identity, font family and visual screenshot checks are not implemented.',
      'Omitted design properties are outside scope. No production conformance score.']};
  const add=(severity,rule,e,property,expected,actualValue,delta,tolerance,evidence)=>r.findings.push({
    severity,rule,node_id:e?.id??null,selector:e?.selector??null,property,
    expected:expected??null,actual:actualValue??null,delta,tolerance,evidence,
    risk:severity==='FAIL'?'Measured implementation differs from the declared design reference.':'Comparison coverage is incomplete; a defect is not established.',
    possible_cause:severity==='FAIL'?'Hypothesis only: differing layout/style value or unresolved normalization. Component source has not been inspected.':'Mapping, capture state or normalization may be incomplete.',
    suggested_fix:severity==='FAIL'?'Inspect the mapped component and approved design value before changing code.':'Resolve the missing evidence; do not substitute zero or select the first match.',
    verify:'Capture the same approved frame/state again, then rerun this property comparison.'});
  for(const k of contextKeys) if(design.context[k]!==actual.context[k]) add('WARN','Context',null,k,design.context[k],actual.context[k],null,null,'Capture contexts differ; property comparison stopped.');
  if(r.findings.length) return r;
  if(!design.elements.length) {add('WARN','Coverage',null,null,null,null,null,null,'No design elements supplied.');return r;}
  const actualById=new Map(actual.elements.map(e=>[e.id,e]));
  const duplicateSelectors=elements=>{
    const counts=new Map();for(const e of elements) counts.set(e.selector,(counts.get(e.selector)??0)+1);
    return new Set([...counts].filter(([,n])=>n>1).map(([selector])=>selector));
  };
  const ambiguous=new Set([...duplicateSelectors(design.elements),...duplicateSelectors(actual.elements)]);
  for(const e of design.elements) {
    const a=actualById.get(e.id);
    if(!a||a.matches!==1||a.selector!==e.selector||!a.visible||ambiguous.has(e.selector)) {
      add('WARN','Mapping',e,null,{selector:e.selector,matches:1,visible:true},a?{selector:a.selector,matches:a.matches,visible:a.visible}:null,null,null,'No unique visible counterpart with the declared selector.');continue;
    }
    const props=Object.keys(e.properties);
    if(!props.length) add('WARN','Coverage',e,null,null,null,null,null,'Element has no declared properties.');
    for(const p of props) {
      const expected=e.properties[p],value=a.properties[p],rule=ruleFor(p);
      if(rule==='Typography'&&!a.fonts_ready) {add('WARN',rule,e,p,expected,value,null,null,'Fonts were not ready at capture time.');continue;}
      const measured=measurement(p,expected,value);
      if(!measured) {add('WARN',rule??'Unsupported',e,p,expected,value,null,null,'Unknown, missing or unsupported measurement.');continue;}
      r.compared_properties++;
      if(measured.status==='PASS') r.passed_properties++;
      else add('FAIL',rule,e,p,expected,value,measured.delta,measured.tolerance,'Normalized values differ beyond the specified tolerance.');
    }
  }
  const designIds=new Set(design.elements.map(e=>e.id));
  for(const e of actual.elements) if(!designIds.has(e.id)) add('WARN','Mapping',e,null,null,null,null,null,'Actual element has no declared design counterpart.');
  r.status=r.findings.some(f=>f.severity==='FAIL')?'FAIL':r.findings.length||!r.compared_properties?'WARN':'PASS';
  return r;
}
export function parseArgs(args) {
  const out={};
  for(let i=0;i<args.length;i++) {
    const arg=args[i];
    if(arg==='--help') return {help:true};
    if(arg==='--json') {out.json=true;continue;}
    if(!['--design','--actual'].includes(arg)||!args[i+1]||args[i+1].startsWith('--')||out[arg.slice(2)]) throw new Error('Invalid arguments');
    out[arg.slice(2)]=args[++i];
  }
  if(!out.design||!out.actual) throw new Error('Missing inputs');return out;
}
function load(path) {
  const stat=statSync(path);if(!stat.isFile()||stat.size>2*1024*1024) throw new Error('Input too large');
  return JSON.parse(readFileSync(path,'utf8').replace(/^\uFEFF/,''));
}
export function format(r) {
  // JSON stringification of user-provided values also escapes terminal control chars.
  return `DESIGN PREFLIGHT: ${r.status}\nCompared: ${r.compared_properties}; within tolerance: ${r.passed_properties}\nScope: ${r.scope}\n\n${r.findings.map(f=>`[${f.severity}] ${f.rule} / ${JSON.stringify(f.node_id)} / ${JSON.stringify(f.property)}\nExpected: ${JSON.stringify(f.expected)}\nActual: ${JSON.stringify(f.actual)}\nDelta: ${f.delta??'unknown'}; tolerance: ${f.tolerance??'unknown'}\nEvidence: ${f.evidence}\nRisk: ${f.risk}\nPossible cause: ${f.possible_cause}\nSuggested fix: ${f.suggested_fix}\nVerify: ${f.verify}`).join('\n\n')}\n\nNot checked:\n${r.limitations.map(x=>'- '+x).join('\n')}\n`;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const args=parseArgs(process.argv.slice(2));
    if(args.help) console.log('node scripts/compare.mjs --design FILE --actual FILE [--json]\nOffline normalized snapshots only; --figma/--url are not implemented.');
    else {const r=compare(load(args.design),load(args.actual));console.log(args.json?JSON.stringify(r,null,2):format(r));process.exitCode={PASS:0,WARN:1,FAIL:2}[r.status];}
  } catch {console.error('Invalid arguments or normalized snapshots. Run --help; input content is not echoed.');process.exitCode=64;}
}
