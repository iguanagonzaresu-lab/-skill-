import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { spawnSync } from 'node:child_process';
import { mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,symlinkSync,existsSync } from 'node:fs';
import { join,dirname,resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { scan,classify,parseNameStatus,addedLines,parseArgs,sensitive,formatReport } from '../scripts/run-preflight.mjs';
import { runNpmCheck } from '../scripts/check-runner.mjs';

const skill=fileURLToPath(new URL('../',import.meta.url));
const git=(root,...args)=>execFileSync('git',['-c','core.autocrlf=false',...args],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true});
const put=(root,path,text)=>{mkdirSync(dirname(join(root,path)),{recursive:true});writeFileSync(join(root,path),text);};
async function fixture(fn,{commit=true}={}) {
  const root=mkdtempSync(join(tmpdir(),'preflight-regression-test-'));
  try {
    git(root,'init','--initial-branch=main');put(root,'index.js','export const x=1;\n');
    put(root,'package.json',JSON.stringify({scripts:{test:'node -e "process.exit(0)"',build:'node -e "process.exit(0)"'}}));
    if(commit) {git(root,'add','.');git(root,'-c','user.name=Preflight Tests','-c','user.email=test@example.invalid','commit','-m','fixture');}
    await fn(root);
  } finally {
    assert.ok(resolve(root).startsWith(resolve(tmpdir())+'\\preflight-regression-test-')||resolve(root).startsWith(resolve(tmpdir())+'/preflight-regression-test-'));
    rmSync(root,{recursive:true,force:true});
  }
}
const ok=async(_root,name)=>({name,status:'PASS',reason:'exit 0',duration_ms:1,exit_code:0});

test('classifier selects overlapping packs without selecting everything',()=>{
  assert.deepEqual(classify('src/api/users.ts'),['Deploy']);
  assert.deepEqual(classify('components/Header.tsx'),['Design','Deploy']);
  assert.deepEqual(classify('docs/readme.md'),['Content']);
  assert.deepEqual(classify('public/index.html'),['Design','Content']);
});
test('NUL diff parser supports spaces/newlines and renames/deletions',()=>{
  assert.deepEqual(parseNameStatus('R100\0old file.ts\0new\nfile.ts\0D\0deleted.css\0'),[
    {status:'R',path:'new\nfile.ts',old_path:'old file.ts'},{status:'D',path:'deleted.css'}]);
  assert.throws(()=>parseNameStatus('R100\0old\0'));
});
test('hunks identify only added current lines',()=>{
  assert.deepEqual(addedLines('diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -3,1 +3,2 @@\n-old\n+new\n+next\n'),[{line:3,text:'new'},{line:4,text:'next'}]);
});
test('clean worktree is WARN and never invokes checks',async()=>fixture(async root=>{
  const r=await scan({repo:root,run:['test'],runner:()=>assert.fail()});assert.equal(r.status,'WARN');assert.equal(r.changes.length,0);
}));
test('staged, unstaged and untracked changes are all included',async()=>fixture(async root=>{
  put(root,'index.js','export const x=2;\n');git(root,'add','index.js');put(root,'index.js','export const x=3;\n');put(root,'new.js','export const y=1;\n');
  const r=await scan({repo:root});assert.equal(r.changes.length,2);assert.ok(r.changes.some(x=>x.status==='?'));assert.equal(r.status,'WARN');assert.equal(r.executed.length,0);
}));
test('unborn repository is inspected but baseline remains WARN',async()=>fixture(async root=>{
  git(root,'add','index.js');const r=await scan({repo:root});assert.equal(r.scope.head,null);assert.equal(r.changes.length,2);assert.ok(r.findings.some(x=>x.check==='baseline'));
},{commit:false}));
test('explicit base covers already committed changes',async()=>fixture(async root=>{
  const base=git(root,'rev-parse','HEAD').trim();put(root,'index.js','export const x=9;');git(root,'add','.');git(root,'-c','user.name=Tests','-c','user.email=test@example.invalid','commit','-m','next');
  const r=await scan({repo:root,base});assert.equal(r.scope.base,base);assert.equal(r.changes.length,1);
}));
test('invalid base and nonrepository return WARN without exposing git errors',async()=>fixture(async root=>{
  const r=await scan({repo:root,base:'no-such-commit'});assert.equal(r.status,'WARN');assert.equal(r.findings[0].check,'scope');
  const other=await scan({repo:tmpdir()});assert.equal(other.status,'WARN');
  await assert.rejects(scan({repo:root,base:'--help'}));
}));
test('preexisting TODO outside added lines is not reported',async()=>fixture(async root=>{
  put(root,'index.js','// TODO existing issue\nexport const x=1;\n');git(root,'add','.');git(root,'-c','user.name=Tests','-c','user.email=test@example.invalid','commit','-m','existing');
  put(root,'index.js','// TODO existing issue\nexport const x=2;\n');const r=await scan({repo:root});assert.ok(!r.findings.some(x=>x.check==='placeholder'));
}));
test('new placeholder is WARN with a location, not a fabricated bug',async()=>fixture(async root=>{
  put(root,'index.js','// TODO secret-looking-value-must-not-print\nexport const x=2;');const r=await scan({repo:root});
  assert.ok(r.findings.some(x=>x.check==='placeholder'&&x.evidence.includes(':1')));assert.ok(!JSON.stringify(r).includes('secret-looking-value'));
}));
test('conflict marker and invalid JSON block with all finding fields',async()=>fixture(async root=>{
  put(root,'index.js','<<<<<<< ours\nx\n=======\ny\n>>>>>>> theirs\n');put(root,'broken.json','{"x":');
  const r=await scan({repo:root});assert.equal(r.status,'BLOCK');assert.ok(r.findings.some(x=>x.check==='json-syntax'));
  for(const f of r.findings) for(const k of ['evidence','risk','fix','verify']) assert.ok(f[k]);
}));
test('sensitive paths are skipped and values never appear',async()=>fixture(async root=>{
  const secret='sk-private-fixture-do-not-expose';put(root,'.env',`OPENAI_API_KEY=${secret}`);put(root,'release.pem',secret);
  const r=await scan({repo:root});assert.equal(r.findings.filter(x=>x.check==='secret-boundary').length,2);assert.ok(!JSON.stringify(r).includes(secret));assert.ok(sensitive('android/key.properties'));
}));
test('deleted files and rename consumers need verification',async()=>fixture(async root=>{
  git(root,'mv','index.js','renamed.js');git(root,'rm','package.json');const r=await scan({repo:root});
  assert.ok(r.changes.some(x=>x.old_path==='index.js'));assert.ok(r.findings.some(x=>x.check==='deletion'));
}));
test('relative local document link exists vs missing, no external requests',async()=>fixture(async root=>{
  put(root,'docs/good.md','text');put(root,'docs/page.md','[ok](good.md)\n[missing](absent.md)\n[external](https://example.invalid/no-network)');
  const r=await scan({repo:root});assert.equal(r.findings.filter(x=>x.check==='local-link').length,1);
}));
test('binary, large and linked paths stay coverage gaps',async()=>fixture(async root=>{
  put(root,'picture.png',Buffer.from([0,1,2]));put(root,'large.js','a'.repeat(256001));
  const r=await scan({repo:root});assert.equal(r.findings.filter(x=>x.check==='inspection-gap').length,2);
}));
test('directory junction outside repository is never read',async()=>fixture(async outside=>{
  put(outside,'secret.txt','SECRET_OUTSIDE_FIXTURE');
  await fixture(async root=>{
    symlinkSync(outside,join(root,'outside'),'junction');
    const r=await scan({repo:root});assert.equal(r.status,'WARN');
    assert.ok(r.findings.some(x=>x.check==='inspection-gap'||x.check==='scope'));
    assert.ok(!JSON.stringify(r).includes('SECRET_OUTSIDE_FIXTURE'));
  });
}));
test('migration classification warns without claiming database diagnosis',async()=>fixture(async root=>{
  put(root,'migrations/001.sql','ALTER TABLE users ADD email TEXT NOT NULL;');const r=await scan({repo:root});
  assert.ok(r.findings.some(x=>x.check==='migration-scope'));assert.ok(!r.findings.some(x=>x.severity==='BLOCK'));
}));
test('fully executed supported deploy checks yield only scoped PASS',async()=>fixture(async root=>{
  put(root,'index.js','export const x=2;');const r=await scan({repo:root,run:['test','build'],runner:ok});
  assert.equal(r.status,'PASS');assert.equal(r.executed.length,2);assert.ok(r.limitations.length>0);
}));
test('one passing test does not erase a skipped build',async()=>fixture(async root=>{
  put(root,'index.js','export const x=2;');const r=await scan({repo:root,run:['test'],runner:ok});assert.equal(r.status,'WARN');
}));
test('design never passes solely because build/test passed',async()=>fixture(async root=>{
  put(root,'Header.tsx','export const Header=()=>null;');const r=await scan({repo:root,run:['test','build'],runner:ok});assert.equal(r.status,'WARN');assert.ok(r.findings.some(x=>x.check==='design-evidence'));
}));
test('nonzero command blocks, timeout warns, unsupported commands cannot run',async()=>fixture(async root=>{
  put(root,'index.js','export const x=2;');
  const fail=await scan({repo:root,run:['test','build'],runner:async(_r,name)=>({name,status:'BLOCK',reason:'nonzero exit',duration_ms:1})});assert.equal(fail.status,'BLOCK');
  const timed=await scan({repo:root,run:['test','build'],runner:async(_r,name)=>({name,status:'WARN',reason:'timeout',duration_ms:1})});assert.equal(timed.status,'WARN');
  await assert.rejects(scan({repo:root,run:['deploy']}));
}));
test('read-only scan preserves files and Git status',async()=>fixture(async root=>{
  put(root,'index.js','export const x=3;');const before=git(root,'status','--porcelain=v1');const text=readFileSync(join(root,'index.js'),'utf8');
  await scan({repo:root});assert.equal(git(root,'status','--porcelain=v1'),before);assert.equal(readFileSync(join(root,'index.js'),'utf8'),text);
}));
test('real npm runner executes explicit check and ignores pre/post hooks',async()=>fixture(async root=>{
  put(root,'package.json',JSON.stringify({scripts:{pretest:'node -e "process.exit(11)"',test:'node -e "process.exit(0)"',posttest:'node -e "process.exit(12)"',build:'node -e "process.exit(3)"'}}));
  assert.equal((await runNpmCheck(root,'test')).status,'PASS');assert.equal((await runNpmCheck(root,'build')).status,'BLOCK');
}));
test('real command timeout is WARN without exposing stdout',async()=>fixture(async root=>{
  put(root,'package.json',JSON.stringify({scripts:{test:'node -e "console.log(\'SECRET_FIXTURE\');setInterval(()=>{},1000)"'}}));
  const result=await runNpmCheck(root,'test',{timeoutMs:600});assert.equal(result.status,'WARN');assert.equal(result.reason,'timeout');assert.ok(!JSON.stringify(result).includes('SECRET_FIXTURE'));
}));
test('CLI validates timeout/options and report includes all evidence headings',()=>{
  assert.equal(parseArgs(['--repo','a b','--run','test,build','--timeout','3','--json']).options.timeoutMs,3000);
  for(const args of [['--unknown'],['--timeout','0'],['--timeout','999'],['--repo']]) assert.throws(()=>parseArgs(args));
  assert.ok(formatReport({status:'WARN',scope:{},packs:[],changes:[],executed:[],findings:[{severity:'WARN',check:'a',evidence:'b',risk:'c',fix:'d',verify:'e'}],limitations:[]}).includes('Verify: e'));
});
test('skill package frontmatter, local references and metadata are complete',()=>{
  const text=readFileSync(join(skill,'SKILL.md'),'utf8');assert.match(text,/^---\r?\nname: preflight-regression\r?\ndescription: [^\r\n]+\r?\n---/);
  for(const m of text.matchAll(/\]\((references\/[^)]+)\)/g)) assert.ok(existsSync(join(skill,m[1])));
  assert.ok(readFileSync(join(skill,'agents/openai.yaml'),'utf8').includes('$preflight-regression'));
});
test('normal HTML placeholder attribute is not a draft-text finding',async()=>fixture(async root=>{
  put(root,'form.html','<input placeholder="Email">');const r=await scan({repo:root});assert.ok(!r.findings.some(f=>f.check==='placeholder'));
}));
test('CLI emits parseable JSON and WARN/BLOCK/usage exit codes',async()=>fixture(async root=>{
  const cli=join(skill,'scripts/run-preflight.mjs');
  const exec=args=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8',windowsHide:true});
  const warn=exec(['--repo',root,'--json']);assert.equal(warn.status,1);assert.equal(JSON.parse(warn.stdout).status,'WARN');
  put(root,'invalid.json','{');const block=exec(['--repo',root,'--json']);assert.equal(block.status,2);assert.equal(JSON.parse(block.stdout).status,'BLOCK');
  assert.equal(exec(['--run','deploy']).status,64);assert.equal(exec(['--help']).status,0);
}));
