import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,existsSync,rmSync,symlinkSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {Context} from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import Tools from '@deepseek-ai/dsh-tools'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import LocalFs from '@deepseek-ai/dsh-fs-local'
import * as FileTools from '@deepseek-ai/dsh-tool-fs'
import * as ShellEnv from '@deepseek-ai/dsh-shell-env'
import Sandbox from '@deepseek-ai/dsh-sandbox-local'
import Bash from '@deepseek-ai/dsh-bash-sandbox'
import NodePtc from '@deepseek-ai/dsh-ptc-runtime-node'
import * as ToolBash from '@deepseek-ai/dsh-tool-bash'
import * as WetFlow from '../index.js'
const root=mkdtempSync(join(tmpdir(),'wf-process-gate-')),data=join(root,'data'),ws=join(root,'workspace')
mkdirSync(ws);mkdirSync(data);mkdirSync(join(ws,'.wetflow'),{recursive:true})
const marker=join(data,'formal.txt'),sop=join(ws,'.wetflow','sop.txt');writeFileSync(marker,'original');writeFileSync(sop,'SOP')
symlinkSync(data,join(ws,'alias'));process.env.DSH_WETFLOW_DATA=data;process.env.DSH_WETFLOW_PORT='14329'
const ctx=new Context();let fiber
const q=s=>"'"+s.replaceAll("'","'\\''")+"'"
try{
 ctx.provide('workspaceRegistry',{list:()=>[{id:'test',path:ws}]});ctx.provide('workingDirectory',{ensure:async()=>ws})
 ctx.provide('sandboxPolicy',{defaultMode:'workspace-write',resolve:()=>({mode:'workspace-write',workspaceRoot:ws})})
 await ctx.plugin(SystemPrompt);await ctx.plugin(Tools);await ctx.plugin(AgentRegistry);await ctx.plugin(LocalSubprocessRuntime);ctx.subprocess.internals={spillDir:root}
 await ctx.plugin(LocalFs,{cwd:ws});await ctx.plugin(FileTools);await ctx.plugin(ShellEnv);await ctx.plugin(Sandbox);await ctx.plugin(Bash);await ctx.plugin(ToolBash,{enableRunInBackground:false,promoteOnTimeout:false})
 fiber=await ctx.plugin(WetFlow)
 await ctx.plugin(NodePtc)
 const call=(name,args)=>ctx.tools.execute({callId:'gate-test',name,arguments:args,signal:new AbortController().signal})
 const bash=command=>call('bash',{command,description:'Isolated WetFlow gate regression test',workdir:ws})
 const ordinary=join(ws,'ordinary.txt')
 let r=await bash(`printf ordinary > ${q(ordinary)}`);assert.ok(existsSync(ordinary),JSON.stringify(r));assert.equal(readFileSync(ordinary,'utf8'),'ordinary');console.log('PASS ordinary Bash workspace write')
 await bash(`printf bad > ${q(marker)}`);assert.equal(readFileSync(marker,'utf8'),'original')
 await bash(`printf bad > ${q(join(ws,'alias/formal.txt'))}`);assert.equal(readFileSync(marker,'utf8'),'original')
 await bash(`python3 -c ${q('from pathlib import Path; Path('+JSON.stringify(marker)+').write_text("bad")')}`);assert.equal(readFileSync(marker,'utf8'),'original')
 await bash(`rm -rf ${q(data)}`);assert.equal(readFileSync(marker,'utf8'),'original')
 await bash(`printf bad > ${q(sop)}`);assert.equal(readFileSync(sop,'utf8'),'SOP')
 await bash(`ln ${q(sop)} ${q(join(ws,'hardlink'))} && printf bad > ${q(join(ws,'hardlink'))}`);assert.equal(readFileSync(sop,'utf8'),'SOP')
 await bash(`mv ${q(join(ws,'.wetflow'))} ${q(join(ws,'moved'))}`);assert.ok(existsSync(sop));console.log('PASS shell/Python/symlink/hardlink/delete/rename attempts')
 await bash(`curl --max-time 2 --fail -s http://127.0.0.1:14329/api/snapshot > ${q(join(ws,'api.txt'))}`);assert.equal(readFileSync(join(ws,'api.txt'),'utf8'),'')
 await bash(`cat /proc/${process.pid}/environ > ${q(join(ws,'parent-env'))}`);assert.equal(readFileSync(join(ws,'parent-env'),'utf8'),'');console.log('PASS localhost API and host-process access blocked')
 for(const path of [marker,join(ws,'alias/formal.txt'),sop]){
  r=await call('write',{file_path:path,content:'bad'});assert.equal(r.isError,true,JSON.stringify(r))
  r=await call('edit',{file_path:path,old_string:path===sop?'SOP':'original',new_string:'bad'});assert.equal(r.isError,true,JSON.stringify(r))
 }
 r=await call('read',{file_path:sop});assert.equal(r.isError,false,JSON.stringify(r))
 r=await call('write',{file_path:ordinary,content:'normal'});assert.equal(r.isError,false,JSON.stringify(r))
 r=await call('edit',{file_path:ordinary,old_string:'normal',new_string:'edited'});assert.equal(r.isError,false,JSON.stringify(r));assert.equal(readFileSync(ordinary,'utf8'),'edited')
 assert.equal(readFileSync(marker,'utf8'),'original');assert.equal(readFileSync(sop,'utf8'),'SOP');console.log('PASS real read/write/edit: normal files work; records protected')
 // Even an executor request labelled danger-full-access must cross the lower process gate.
 const h=await ctx.shell.execute(ctx.shell.resolve({command:`printf bad > ${q(marker)}`,workdir:ws,sandboxPolicy:{mode:'danger-full-access',workspaceRoot:ws}}));await h.result();assert.equal(readFileSync(marker,'utf8'),'original');console.log('PASS elevated shell cannot bypass the lower gate')
 const state=await(await fetch('http://127.0.0.1:14329/api/wetflow-security')).json();assert.equal(state.status,'active')
 if(process.env.WETFLOW_TEST_PUBLIC_NETWORK==='1'){
  r=await bash(`curl --fail --retry 2 --retry-all-errors --max-time 20 -sS https://registry.npmjs.org/is-number/latest > ${q(join(ws,'public.json'))}`);assert.ok(readFileSync(join(ws,'public.json'),'utf8'),JSON.stringify(r));assert.equal(JSON.parse(readFileSync(join(ws,'public.json'),'utf8')).name,'is-number');console.log('PASS real Bash HTTPS download')
  await bash(`npm view is-number version > ${q(join(ws,'npm-version.txt'))}`);assert.match(readFileSync(join(ws,'npm-version.txt'),'utf8'),/^\d+\./);console.log('PASS npm registry access')
  r=await bash(`npm install --prefix ${q(join(ws,'npm-test'))} --ignore-scripts --no-audit --no-fund is-number@7.0.0`);assert.ok(existsSync(join(ws,'npm-test','node_modules','is-number','index.js')),JSON.stringify(r));console.log('PASS npm project dependency installation')
  await bash(`python3 -m pip download --no-deps --no-cache-dir --index-url https://pypi.org/simple --dest ${q(join(ws,'packages'))} six==1.17.0 > ${q(join(ws,'pip-result.txt'))} 2>&1`);assert.ok(existsSync(join(ws,'packages','six-1.17.0-py2.py3-none-any.whl')),readFileSync(join(ws,'pip-result.txt'),'utf8'));console.log('PASS pip package download')
  r=await bash(`python3 -m pip install --no-deps --no-cache-dir --index-url https://pypi.org/simple --target ${q(join(ws,'python-packages'))} six==1.17.0`);assert.ok(existsSync(join(ws,'python-packages','six.py')),JSON.stringify(r));console.log('PASS pip installation into workspace')
  for(const url of ['http://localhost:14329/api/snapshot','http://127.0.0.1/','http://2130706433/','http://[::1]/','http://10.0.0.1/','http://169.254.169.254/']){
   await bash(`curl --fail --max-time 2 -s ${q(url)} > ${q(join(ws,'denied.txt'))}`);assert.equal(readFileSync(join(ws,'denied.txt'),'utf8'),'')
  }
  console.log('PASS proxy blocks loopback, alternative IP notation, IPv6 loopback, private IP and metadata')
 }
 const code=await ctx.ptcRuntime.run(ctx.ptcRuntime.resolve({program:`const fs=await import('node:fs'); fs.writeFileSync(${JSON.stringify(join(ws,'ptc.txt'))},'code-ok'); let blocked=false; try { fs.writeFileSync(${JSON.stringify(marker)},'bad') } catch { blocked=true } return blocked;`,bindings:[],cwd:ws,sandboxPolicy:{mode:'danger-full-access',workspaceRoot:ws}}));assert.equal(code.error,undefined,JSON.stringify(code));assert.equal(code.value,true);assert.equal(readFileSync(join(ws,'ptc.txt'),'utf8'),'code-ok');assert.equal(readFileSync(marker,'utf8'),'original');console.log('PASS real Node PTC: ordinary code works, record bypass blocked')
 const terminal=await ctx.subprocess.spawnTerminal({argv:['bash','-c',`printf terminal > ${q(join(ws,'terminal.txt'))}; printf bad > ${q(marker)}`],cwd:ws,env:{},rows:24,cols:80,terminalType:'xterm',graceMs:200});terminal.output.resume();await terminal.done;assert.equal(readFileSync(join(ws,'terminal.txt'),'utf8'),'terminal');assert.equal(readFileSync(marker,'utf8'),'original');console.log('PASS persistent-terminal process entry is also confined')
 await fiber.dispose();fiber=undefined
 const after=await ctx.shell.execute(ctx.shell.resolve({command:`printf restored > ${q(marker)}`,workdir:ws,sandboxPolicy:{mode:'danger-full-access',workspaceRoot:ws}}));await after.result();assert.equal(readFileSync(marker,'utf8'),'restored');console.log('PASS plugin disposal restores ordinary runtime')
 process.env.DSH_WETFLOW_BWRAP=join(root,'missing-runner');fiber=await ctx.plugin(WetFlow)
 const unavailable=await(await fetch('http://127.0.0.1:14329/api/wetflow-security')).json();assert.equal(unavailable.status,'unavailable')
 await bash(`printf bad > ${q(marker)}`);assert.equal(readFileSync(marker,'utf8'),'restored');console.log('PASS missing sandbox fails closed without an unconfined fallback')
}finally{if(fiber)await fiber.dispose();await ctx.fiber.dispose();rmSync(root,{recursive:true,force:true})}
