import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname,join } from 'node:path';

export const ALLOWED_CHECKS=['test','build','lint','typecheck'];

export function runNpmCheck(root,name,{timeoutMs=120000}={}) {
  if(!ALLOWED_CHECKS.includes(name)) throw new Error('Unsupported check');
  // Use the installed npm CLI without constructing shell commands, including Windows.
  const dir=dirname(process.execPath);
  const cli=[join(dir,'node_modules/npm/bin/npm-cli.js'),join(dir,'../lib/node_modules/npm/bin/npm-cli.js')].find(existsSync);
  if(!cli) return Promise.resolve({name,status:'WARN',reason:'npm CLI not found beside Node',duration_ms:0});
  return new Promise(resolve=>{
    const started=Date.now();let bytes=0,stopped=null;
    const child=spawn(process.execPath,[cli,'--ignore-scripts','run',name],{
      cwd:root,shell:false,windowsHide:true,detached:process.platform!=='win32',
      stdio:['ignore','pipe','pipe'],env:{...process.env,CI:'1',NO_COLOR:'1',npm_config_update_notifier:'false'}});
    const stop=reason=>{
      if(stopped) return;stopped=reason;
      if(!child.pid) return;
      if(process.platform==='win32') {
        const killer=spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore',shell:false});
        killer.on('error',()=>child.kill());
      } else {try {process.kill(-child.pid,'SIGKILL');} catch {child.kill('SIGKILL');}}
    };
    const timer=setTimeout(()=>stop('timeout'),timeoutMs);
    const count=chunk=>{bytes+=chunk.length;if(bytes>256000) stop('output limit');};
    child.stdout.on('data',count);child.stderr.on('data',count);
    child.on('error',()=>{clearTimeout(timer);resolve({name,status:'WARN',reason:'could not start',duration_ms:Date.now()-started});});
    child.on('close',code=>{
      clearTimeout(timer);
      resolve({name,status:stopped?'WARN':code===0?'PASS':'BLOCK',
        reason:stopped??(code===0?'exit 0':code==null?'terminated':'nonzero exit'),
        exit_code:code,duration_ms:Date.now()-started});
    });
  });
}
