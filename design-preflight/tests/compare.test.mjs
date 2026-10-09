import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { compare,measurement,parseArgs,format } from '../scripts/compare.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const fixture=()=>['design','actual'].map(n=>JSON.parse(readFileSync(join(root,`examples/${n}.json`),'utf8')));
test('synthetic example detects three distinct measured rule failures',()=>{
  const [d,a]=fixture(),r=compare(d,a);assert.equal(r.status,'FAIL');assert.equal(r.findings.length,3);assert.equal(r.compared_properties,8);
  assert.deepEqual(r.findings.map(f=>f.rule),['Layout','Typography','Color']);assert.equal(r.findings[0].delta,4);
});
test('identical declared values produce a scoped PASS',()=>{
  const [d,a]=fixture();a.elements[0].properties=structuredClone(d.elements[0].properties);const r=compare(d,a);assert.equal(r.status,'PASS');assert.equal(r.passed_properties,8);assert.ok(r.limitations.length);
});
test('tolerance boundaries inclusive, not rounded away',()=>{
  assert.equal(measurement('height',48,47).status,'PASS');assert.equal(measurement('height',48,46.999).status,'FAIL');
  assert.equal(measurement('font_size',16,15.5).status,'PASS');assert.equal(measurement('font_weight',600,599).status,'FAIL');
  assert.equal(measurement('background_color',[0,0,0,1],[2,2,2,1]).status,'PASS');
});
test('invalid or unknown measurements are never zero or PASS',()=>{
  for(const v of [null,undefined,'normal',NaN,Infinity,-1]) assert.equal(measurement('height',48,v),null);
  assert.equal(measurement('font_weight',1001,400),null);assert.equal(measurement('unsupported',1,1),null);
  assert.equal(measurement('letter_spacing',-1,-1).status,'PASS');
});
test('color alpha participates; transparent RGB is irrelevant',()=>{
  assert.equal(measurement('text_color',[0,0,0,0],[255,255,255,0]).status,'PASS');
  assert.equal(measurement('text_color',[0,0,0,1],[0,0,0,.9]).status,'FAIL');
  assert.equal(measurement('text_color',[256,0,0,1],[0,0,0,1]),null);
});
test('viewport/theme/state mismatch stops comparison rather than yielding misleading FAIL',()=>{
  for(const k of ['width','height','dpr','theme','state']) {const [d,a]=fixture();a.context[k]=typeof a.context[k]==='number'?2:'different';const r=compare(d,a);assert.equal(r.status,'WARN');assert.equal(r.compared_properties,0);}
});
test('missing/ambiguous/invisible/mismatched element is WARN, no style guess',()=>{
  for(const mutate of [a=>a.elements=[],a=>a.elements[0].matches=2,a=>a.elements[0].matches=0,a=>a.elements[0].visible=false,a=>a.elements[0].selector='#different']) {
    const [d,a]=fixture();mutate(a);const r=compare(d,a);assert.equal(r.status,'WARN');assert.equal(r.compared_properties,0);
  }
});
test('unready fonts skip typography while retaining other evidence',()=>{
  const [d,a]=fixture();a.elements[0].fonts_ready=false;const r=compare(d,a);assert.equal(r.compared_properties,4);assert.equal(r.findings.filter(f=>f.rule==='Typography'&&f.severity==='WARN').length,4);
});
test('undeclared support, empty design and missing values cannot create PASS',()=>{
  const [d,a]=fixture();d.elements[0].properties={radius:8,height:null};const r=compare(d,a);assert.equal(r.status,'WARN');assert.equal(r.compared_properties,0);
  d.elements=[];assert.equal(compare(d,a).status,'WARN');
});
test('duplicate IDs and invalid metadata are input errors',()=>{
  const [d,a]=fixture();d.elements.push(structuredClone(d.elements[0]));assert.throws(()=>compare(d,a));
  const [e,b]=fixture();b.context.coordinate_space='page';assert.throws(()=>compare(e,b));
});
test('two design nodes cannot silently reuse one selector',()=>{
  const [d,a]=fixture();d.elements.push({...structuredClone(d.elements[0]),id:'8:8'});
  const r=compare(d,a);assert.equal(r.status,'WARN');assert.equal(r.compared_properties,0);
});
test('extra actual elements warn even when declared properties pass',()=>{
  const [d,a]=fixture();a.elements[0].properties=structuredClone(d.elements[0].properties);a.elements.push({...structuredClone(a.elements[0]),id:'9:9'});assert.equal(compare(d,a).status,'WARN');
});
test('all findings carry evidence, uncertainty and verification; inputs unchanged',()=>{
  const [d,a]=fixture(),before=JSON.stringify([d,a]);const r=compare(d,a);assert.equal(JSON.stringify([d,a]),before);
  for(const f of r.findings) for(const k of ['evidence','risk','possible_cause','suggested_fix','verify']) assert.ok(f[k]);assert.ok(format(r).includes('Hypothesis only'));
});
test('CLI is executable, JSON has expected FAIL, live flags are rejected',()=>{
  const cmd=join(root,'scripts/compare.mjs');const run=args=>spawnSync(process.execPath,[cmd,...args],{cwd:root,encoding:'utf8',windowsHide:true});
  const result=run(['--design','examples/design.json','--actual','examples/actual.json','--json']);assert.equal(result.status,2);assert.equal(JSON.parse(result.stdout).findings.length,3);
  assert.equal(run(['--figma','https://figma.com/']).status,64);assert.throws(()=>parseArgs(['--design','x']));
});
test('skill frontmatter and referenced instruction files exist',()=>{
  const s=readFileSync(join(root,'SKILL.md'),'utf8');assert.match(s,/^---\r?\nname: design-preflight\r?\ndescription: [^\r\n]+\r?\n---/);
  for(const m of s.matchAll(/\]\((references\/[^)]+)\)/g)) assert.ok(existsSync(join(root,m[1])));
});
