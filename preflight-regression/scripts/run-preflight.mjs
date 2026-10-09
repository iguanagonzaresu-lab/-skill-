import { execFileSync } from 'node:child_process';
import { readFileSync,lstatSync,realpathSync,existsSync } from 'node:fs';
import { resolve,relative,isAbsolute,join,extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALLOWED_CHECKS,runNpmCheck } from './check-runner.mjs';

const MAX_FILE=256000,MAX_FILES=2000;
const git=(cwd,args)=>execFileSync('git',['--literal-pathspecs','-c','core.fsmonitor=false',...args],{
  cwd,encoding:'utf8',timeout:10000,maxBuffer:8*1024*1024,windowsHide:true,
  env:{...process.env,GIT_OPTIONAL_LOCKS:'0'},stdio:['ignore','pipe','pipe']});
const items=text=>text.split('\0').filter(Boolean);
export const sensitive=p=>/(^|\/)(\.env(?:\..*)?|key\.properties|credentials(?:\..*)?|secrets?(?:\..*)?|id_rsa|id_ed25519)$/i.test(p)||/\.(pem|key|p12|pfx|jks|keystore)$/i.test(p);
export function classify(path) {
  const p=path.toLowerCase(),result=new Set();
  if(/\.(css|scss|sass|less|html?|jsx|tsx|vue|svelte|svg|png|jpe?g|webp|gif|woff2?)$/.test(p)||/(^|\/)(components|styles|public|assets)\//.test(p)) result.add('Design');
  if(/\.(md|mdx|rst|txt|html?)$/.test(p)||/(^|\/)(docs|content)\/|(^|\/)(robots\.txt|sitemap\.xml)$/.test(p)) result.add('Content');
  if(/\.(js|mjs|cjs|ts|tsx|jsx|py|go|rs|java|kt|rb|php|sh|ps1|sql|json|ya?ml|toml)$/.test(p)||/lock|dockerfile|\.env|(^|\/)(api|routes|migrations|\.github)\//.test(p)) result.add('Deploy');
  return [...result];
}
export function parseNameStatus(text) {
  const tokens=items(text),out=[];
  for(let i=0;i<tokens.length;) {
    const status=tokens[i++];
    if(!/^[ACDMRTUXB][0-9]*$/.test(status)||!tokens[i]) throw new Error('Invalid diff inventory');
    const first=tokens[i++];
    if(/^[RC]/.test(status)) {
      if(!tokens[i]) throw new Error('Invalid rename inventory');
      out.push({status:status[0],path:tokens[i++],old_path:first});
    } else out.push({status:status[0],path:first});
  }
  return out;
}
function initialInventory(text) {
  const tokens=items(text),out=[];
  for(let i=0;i<tokens.length;i++) {
    const value=tokens[i],state=value.slice(0,2),path=value.slice(3);
    if(!path) throw new Error('Invalid status inventory');
    const row={status:state==='??'?'?':state.includes('D')?'D':'A',path};
    if(/[RC]/.test(state)) row.old_path=tokens[++i];
    out.push(row);
  }
  return out;
}
export function addedLines(diff) {
  let line=0,inHunk=false;const out=[];
  for(const value of diff.split('\n')) {
    const match=value.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if(match) {line=Number(match[1]);inHunk=true;continue;}
    if(!inHunk) continue;
    if(value.startsWith('+')) out.push({line:line++,text:value.slice(1)});
    else if(value.startsWith(' ')) line++;
  }
  return out;
}
function contained(root,target) {
  const rel=relative(root,target);return rel===''||(!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..\\')&&!rel.startsWith('../'));
}
function readSafe(root,path) {
  const full=resolve(root,path);
  if(!contained(root,full)||lstatSync(full).isSymbolicLink()||!contained(root,realpathSync(full))) throw new Error('path not safe');
  const info=lstatSync(full);if(!info.isFile()||info.size>MAX_FILE) throw new Error('file not bounded text');
  const text=readFileSync(full,'utf8');if(text.includes('\0')||text.includes('\ufffd')) throw new Error('binary or unsupported encoding');
  return text;
}
const finding=(severity,check,evidence,risk,fix,verify)=>({severity,check,evidence,risk,fix,verify});
const outcome=rows=>rows.some(x=>x.severity==='BLOCK')?'BLOCK':rows.some(x=>x.severity==='WARN')?'WARN':'PASS';

export async function scan({repo='.',base=null,run=[],timeoutMs=120000,runner=runNpmCheck}={}) {
  if(run.some(x=>!ALLOWED_CHECKS.includes(x))||new Set(run).size!==run.length) throw new Error('Invalid --run check names');
  if(base&&(/^[\s-]|[\u0000-\u001f]/.test(base)||base.length>200)) throw new Error('Invalid --base');
  const r={version:'0.1.0',status:'WARN',scope:{root:null,base:null,head:null,comparison:'base-to-working-tree plus untracked'},changes:[],packs:[],available_checks:[],executed:[],findings:[],limitations:[
    'Path classification is heuristic; transitive impact is not proven.',
    'No browser rendering, external link requests, environment secrets or database execution.',
    'PASS covers stated executed checks, not production certification; commands may have side effects.'
  ]};
  const add=(...args)=>r.findings.push(finding(...args));
  let root,baseline,initial=false;
  try {
    root=realpathSync(git(resolve(repo),['rev-parse','--show-toplevel']).trim());r.scope.root=root;
    try {r.scope.head=git(root,['rev-parse','--verify','HEAD^{commit}']).trim();} catch {initial=true;}
    if(base) baseline=git(root,['rev-parse','--verify',`${base}^{commit}`]).trim();
    else baseline=r.scope.head;
    r.scope.base=baseline;
    if(baseline) {
      r.changes=parseNameStatus(git(root,['diff','--no-ext-diff','--no-textconv','--name-status','-z','--find-renames',baseline,'--']));
      r.changes.push(...items(git(root,['ls-files','--others','--exclude-standard','-z'])).map(path=>({status:'?',path})));
    } else r.changes=initialInventory(git(root,['status','--porcelain=v1','-z','--untracked-files=all']));
  } catch {
    add('WARN','scope','Git repository or comparison commit could not be resolved.','Change coverage is unknown.','Supply an accessible repository and valid local commit.','Re-run and confirm the resolved base and HEAD.');
    return r;
  }
  if(initial) add('WARN','baseline','Repository has no HEAD commit.','No regression baseline exists.','Confirm initial-release scope.','Review initial files and run applicable checks.');
  if(!r.changes.length) add('WARN','scope','No changes in the selected comparison.','A clean worktree does not verify the latest commit or PR.','Specify the intended earlier --base.','Confirm changed paths against the intended release.');
  if(r.changes.length>MAX_FILES) {add('WARN','size',`${r.changes.length} paths exceeds ${MAX_FILES} inspection limit.`,'Coverage would be incomplete.','Narrow the change in a separate review scope.','Repeat with a bounded comparison.');return r;}
  r.packs=[...new Set(r.changes.flatMap(c=>[...classify(c.path),...classify(c.old_path??'')]))].sort();
  for(const c of r.changes) {
    const path=c.path,at=n=>`${JSON.stringify(path)}${n?':'+n:''}`;
    if(!classify(path).length) add('WARN','unclassified',at(),'Impact cannot be classified from this path.','Inspect the artifact and its consumers.','Record an applicable check result.');
    if(c.status==='D') {add('WARN','deletion',at(),'Removed files may have remaining consumers.','Review imports, links and packaging references.','Run affected workflows.');continue;}
    if(sensitive(path)) {add('WARN','secret-boundary',at(),'Potential secret/configuration file was not read.','Check variable names and deployment configuration without revealing values.','Verify configuration in an authorized environment.');continue;}
    if(/(^|\/)(migrations?|db)\/.*\.sql$/i.test(path)) add('WARN','migration-scope',at(),'Migration safety is outside v0.1 automation.','Review schema, backfill and deployment order.','Obtain migration-specific test evidence without production writes.');
    let text,lines;
    try {
      text=readSafe(root,path);
      lines=!baseline||c.status==='?'||c.status==='A'?text.split('\n').map((text,i)=>({text,line:i+1})):
        addedLines(git(root,['diff','--no-ext-diff','--no-textconv','--no-renames','--unified=0',baseline,'--',path]));
    } catch {add('WARN','inspection-gap',at(),'File could not be safely inspected (binary, large, link, missing or diff failure).','Use artifact-specific checks.','Record a bounded inspection result.');continue;}
    if(extname(path).toLowerCase()==='.json') {
      try {JSON.parse(text.replace(/^\uFEFF/,''));} catch {add('BLOCK','json-syntax',at(),'Changed JSON is not valid JSON; cause may predate this change.','Correct JSON syntax or confirm this is not a JSON artifact.','Parse the file again and run its consumer.');}
    }
    for(const line of lines) {
      if(/^(<{7}|>{7})(?:\s|$)/.test(line.text)) {
        const region=/^<{7}[^\r\n]*\r?\n[\s\S]*?^={7}\r?\n[\s\S]*?^>{7}(?:\s|$)/m.test(text);
        // A lone quoted/example marker is not a confirmed unresolved conflict.
        add(region&&!/\.(md|mdx|txt|rst)$/i.test(path)?'BLOCK':'WARN','conflict-marker',at(line.line),region?'Changed file contains a complete merge-conflict-shaped region; an example may be intentional.':'An added marker needs review; a complete conflict region was not established.','Resolve any real conflict or establish that this is an intentional example.','Check the resolved diff and run affected tests.');
      }
      if(/\b(TODO|TBD|FIXME)\b|\blorem ipsum\b|\bYOUR_(?:API_KEY|TOKEN|PROJECT_ID)\b/i.test(line.text)) add('WARN','placeholder',at(line.line),'Added text contains a review marker; it may be intentional.','Confirm whether this is an example or unfinished release content.','Inspect the published context.');
      if(!/\.(md|mdx|html?)$/i.test(path)) continue;
      const links=[...line.text.matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)|(?:href|src)=["']([^"']+)["']/g)].map(m=>m[1]??m[2]);
      for(const link of links) {
        if(/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(link)) continue;
        let local;try {local=decodeURIComponent(link.split(/[?#]/)[0]);} catch {local='';}
        if(!local||local.includes('\0')) {add('WARN','link-format',at(line.line),'Local link could not be interpreted.','Review its encoding.','Open the intended destination.');continue;}
        const target=resolve(root,join(path,'..',local));
        if(!contained(root,target)||!existsSync(target)) add('WARN','local-link',at(line.line),'Relative link target is absent or outside this repository; generated routing may explain it.','Check the link against the build/routing context.','Build and open the destination.');
      }
    }
  }
  if(r.packs.includes('Design')) add('WARN','design-evidence',r.changes.filter(c=>classify(c.path).includes('Design')).map(c=>JSON.stringify(c.path)).join(', '),'No browser/visual/a11y verification was performed by this scanner.','Follow references/design.md.','Record responsive and keyboard checks at the affected pages.');
  if(r.packs.includes('Content')) add('WARN','content-evidence','Content pack selected; only simple local static checks performed.','Anchors, rendered metadata, dates and external links are not verified.','Follow references/content.md.','Record contextual review and relevant link/render checks.');
  let packageData;
  try {packageData=JSON.parse(readSafe(root,'package.json'));} catch {packageData=null;}
  const scripts=packageData?.scripts;
  r.available_checks=ALLOWED_CHECKS.filter(k=>scripts&&typeof scripts[k]==='string'&&scripts[k].trim());
  // Unknown or no-change scope must not execute project commands.
  if(r.changes.length) for(const name of run) {
    if(!r.available_checks.includes(name)) {
      add('WARN','missing-command',`Root npm ${name} is not available.`,'Requested verification was not performed.','Choose the correct workspace/tooling.','Run an approved equivalent check.');continue;
    }
    const check=await runner(root,name,{timeoutMs});r.executed.push(check);
    if(check.status!=='PASS') add(check.status,'command',`npm ${name}: ${check.reason}; duration ${check.duration_ms} ms.`,'The check did not pass on this snapshot; regression causality is unknown.','Inspect the check safely and correct confirmed failures.','Re-run this check and any affected workflow.');
  }
  if(r.changes.length&&r.packs.some(p=>p==='Deploy'||p==='Design')) {
    const missing=r.available_checks.filter(n=>!r.executed.some(c=>c.name===n));
    if(!r.available_checks.length||missing.length) add('WARN','execution-gap',missing.length?`Not executed: ${missing.join(', ')}.`:'No supported root npm checks discovered.','Build/test coverage is incomplete.','Inspect applicable scripts, then explicitly authorize needed checks.','Run selected checks or provide equivalent pack evidence.');
  }
  r.status=outcome(r.findings);return r;
}

export function parseArgs(args) {
  const options={run:[]};let json=false;
  for(let i=0;i<args.length;i++) {
    const arg=args[i];
    if(arg==='--json') {json=true;continue;}
    if(arg==='--help') return {help:true};
    if(!['--repo','--base','--run','--timeout'].includes(arg)||!args[i+1]||args[i+1].startsWith('--')) throw new Error('Invalid arguments');
    const value=args[++i];
    if(arg==='--run') options.run=value.split(',');
    else if(arg==='--timeout') {
      const seconds=Number(value);if(!Number.isInteger(seconds)||seconds<1||seconds>300) throw new Error('Invalid timeout');options.timeoutMs=seconds*1000;
    } else options[arg.slice(2)]=value;
  }
  return {options,json};
}
export function formatReport(r) {
  return `PREFLIGHT: ${r.status}\nScope: ${JSON.stringify(r.scope)}\nPacks: ${r.packs.join(', ')||'none'}\nChanged files: ${r.changes.length}\nExecuted: ${r.executed.map(x=>`${x.name}=${x.status}`).join(', ')||'none'}\n\n${r.findings.map(f=>`[${f.severity}] ${f.check}\nEvidence: ${f.evidence}\nRisk: ${f.risk}\nFix: ${f.fix}\nVerify: ${f.verify}`).join('\n\n')}\n\nLimitations:\n${r.limitations.map(x=>'- '+x).join('\n')}\n`;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const {options,json,help}=parseArgs(process.argv.slice(2));
    if(help) console.log('node run-preflight.mjs --repo PATH [--base LOCAL_COMMIT] [--run test,build,lint,typecheck] [--timeout 1..300] [--json]\nDefault is read-only; --run executes reviewed project code.');
    else {const r=await scan(options);console.log(json?JSON.stringify(r,null,2):formatReport(r));process.exitCode={PASS:0,WARN:1,BLOCK:2}[r.status];}
  } catch {console.error('PREFLIGHT: invalid arguments or inspection failure. Run --help. No raw command output is shown.');process.exitCode=64;}
}
