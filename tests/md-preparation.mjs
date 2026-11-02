import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, symlinkSync, linkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import Tools from '@deepseek-ai/dsh-tools'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import Subprocess from '@deepseek-ai/dsh-subprocess-local'
import Fs from '@deepseek-ai/dsh-fs-local'
import * as FileTools from '@deepseek-ai/dsh-tool-fs'
import * as ShellEnv from '@deepseek-ai/dsh-shell-env'
import Sandbox from '@deepseek-ai/dsh-sandbox-local'
import Bash from '@deepseek-ai/dsh-bash-sandbox'
import * as ToolBash from '@deepseek-ai/dsh-tool-bash'
import * as WetFlow from '../index.js'
import { importPreparedInputs } from '../md/prepared-inputs.js'
import { listWorkspaceFiles, workspaceFilesContext } from '../workspace-files.js'

const root = mkdtempSync(join(tmpdir(), 'wf-md-preparation-'))
const data = join(root, 'data'), workspace = join(root, 'workspace')
mkdirSync(workspace); mkdirSync(data)
process.env.DSH_WETFLOW_DATA = data; process.env.DSH_WETFLOW_PORT = '14335'
const ctx = new Context(); let fiber
const registry = {list:()=>[{id:'test',path:workspace}]}
const q = value => "'" + value.replaceAll("'", "'\\''") + "'"
const script = `import openmm as mm
from openmm import app, unit, Vec3
from pathlib import Path
out=Path(__file__).parent
t=app.Topology(); c=t.addChain(); r=t.addResidue('MOL',c)
a=t.addAtom('C1',app.element.carbon,r); b=t.addAtom('C2',app.element.carbon,r); t.addBond(a,b)
s=mm.System(); s.addParticle(12); s.addParticle(12)
f=mm.HarmonicBondForce(); f.addBond(0,1,0.15,1000); s.addForce(f)
(out/'system.xml').write_text(mm.XmlSerializer.serialize(s))
with (out/'structure.pdb').open('w') as fp:
    app.PDBFile.writeFile(t,[Vec3(0,0,0),Vec3(0.15,0,0)]*unit.nanometer,fp)
`

try {
  ctx.provide('workspaceRegistry',registry); ctx.provide('workingDirectory',{ensure:async()=>workspace})
  ctx.provide('sandboxPolicy',{defaultMode:'workspace-write',resolve:()=>({mode:'workspace-write',workspaceRoot:workspace})})
  await ctx.plugin(SystemPrompt); await ctx.plugin(Tools); await ctx.plugin(AgentRegistry)
  await ctx.plugin(Subprocess); ctx.subprocess.internals={spillDir:root}
  await ctx.plugin(Fs,{cwd:workspace}); await ctx.plugin(FileTools)
  await ctx.plugin(ShellEnv); await ctx.plugin(Sandbox); await ctx.plugin(Bash)
  await ctx.plugin(ToolBash,{enableRunInBackground:false,promoteOnTimeout:false}); fiber=await ctx.plugin(WetFlow)
  const agent={session:{header:{cwd:workspace}}}
  const call=(name,args)=>ctx.tools.execute({callId:'md-preparation-test',name,arguments:args,agent,signal:new AbortController().signal})
  const ok=async(name,args)=>{const r=await call(name,args);assert.equal(r.isError,false,JSON.stringify(r));return r}
  const bash=command=>ok('bash',{command,description:'MD preparation integration test',workdir:workspace})
  const runId=JSON.parse((await ok('wetflow_status',{})).value).workflow.id
  const params={runId,inputMode:'system',pdbPath:'structure.pdb',systemPath:'system.xml',preparationScriptPath:'prepare.py',notes:'Two-particle integration fixture, not a scientific force-field validation.'}
  await ok('write',{file_path:join(workspace,'prepare.py'),content:script})
  await ok('edit',{file_path:join(workspace,'prepare.py'),old_string:'f.addBond(0,1,0.15,1000)',new_string:'f.addBond(0,1,0.16,1000)'})
  await bash('python3 prepare.py')
  assert.match(readFileSync(join(workspace,'system.xml'),'utf8'),/System/)
  console.log('PASS actual DSH write/edit/Bash prepare a custom OpenMM input')
  const imported=JSON.parse((await ok('wetflow_md_import_inputs',params)).value)
  assert.equal(imported.validation.atomCount,2)
  assert.match(imported.preparationScriptPath,/\.wetflow\/files\//)
  const original=readFileSync(imported.preparationScriptPath,'utf8')
  assert.match(original,/0\.16/)
  const manifest=JSON.parse(readFileSync(imported.manifestPath,'utf8'))
  assert.equal(manifest.sources.script,'prepare.py'); assert.equal(manifest.runId,runId)
  const files=listWorkspaceFiles(workspace,runId)
  assert.equal(files.length,4)
  const fileList=await(await fetch('http://127.0.0.1:14335/api/workspace-files?workspaceId=test')).json()
  assert.ok(fileList.items.some(f=>f.path===imported.pdbPath))
  assert.ok(workspaceFilesContext(agent,registry,runId).includes(imported.pdbPath))
  console.log('PASS validated inputs and script snapshot appear in workbench and Agent context')
  const start={runId,inputMode:'system',pdbPath:imported.pdbPath,systemPath:imported.systemPath,platform:'CPU',steps:100,reportEvery:20,temperatureK:300,timestepFs:1}
  const taskId=JSON.parse((await ok('wetflow_md_start',start)).value).id
  let task
  for(let i=0;i<300;i++) {
    task=JSON.parse((await ok('wetflow_md_task',{runId,taskId})).value)
    if(['completed','failed'].includes(task.status))break
    await new Promise(r=>setTimeout(r,100))
  }
  assert.equal(task.status,'completed',task.error)
  assert.equal(task.result.completedSteps,100); assert.equal(task.preparation.scriptPath,imported.preparationScriptPath)
  console.log('PASS imported prepared inputs complete a new 100-step CPU MD task with provenance')
  await ok('write',{file_path:join(workspace,'prepare.py'),content:script+'\n# revision two\n'})
  await bash('python3 prepare.py')
  const second=JSON.parse((await ok('wetflow_md_import_inputs',params)).value)
  assert.notEqual(second.pdbPath,imported.pdbPath)
  assert.equal(readFileSync(imported.preparationScriptPath,'utf8'),original)
  const mixed=await call('wetflow_md_start',{...start,systemPath:second.systemPath})
  assert.equal(mixed.isError,true)
  await bash(`printf overwrite > ${q(imported.preparationScriptPath)}`)
  const denied=await call('write',{file_path:imported.pdbPath,content:'overwrite'})
  assert.equal(denied.isError,true); assert.equal(readFileSync(imported.preparationScriptPath,'utf8'),original)
  console.log('PASS revisions preserve prior inputs; mixed bundles and direct overwrites are rejected')

  const before=listWorkspaceFiles(workspace,runId).length
  const reject=async patch=>{const r=await call('wetflow_md_import_inputs',{...params,...patch});assert.equal(r.isError,true,JSON.stringify(r));assert.equal(listWorkspaceFiles(workspace,runId).length,before)}
  const outsider=join(data,'outside.pdb'); writeFileSync(outsider,readFileSync(imported.pdbPath))
  symlinkSync(outsider,join(workspace,'linked.pdb')); linkSync(outsider,join(workspace,'hard.pdb'))
  await reject({pdbPath:outsider}); await reject({pdbPath:'linked.pdb'}); await reject({pdbPath:'hard.pdb'})
  await reject({pdbPath:imported.pdbPath}); await reject({runId:'stale-run'})
  await reject({preparationScriptPath:'missing.py'})
  writeFileSync(join(workspace,'invalid.xml'),'<invalid/>'); await reject({systemPath:'invalid.xml'})
  // A syntactically valid System can still describe a different number of atoms.
  await bash("python3 -c 'import openmm as m; s=m.System(); s.addParticle(12); open(\"mismatch.xml\",\"w\").write(m.XmlSerializer.serialize(s))'")
  await reject({systemPath:'mismatch.xml'})
  assert.equal(readdirSync(dirname(dirname(imported.pdbPath))).some(name=>name.startsWith('.upload-')),false)
  console.log('PASS wrong run, outside paths, symlinks, hardlinks, protected paths and invalid/mismatched XML rejected atomically')

  // Switch the active run while the genuine sandboxed validator is starting.
  let current=runId
  await assert.rejects(importPreparedInputs({registry,getRun:()=>current,
    runtime:{spawn:spec=>{const handle=ctx.subprocess.spawn(spec);current='different-run';return handle}},
    protectedRoots:[data],workspaceId:'test',runId,params}),/运行已切换/)
  const controller=new AbortController();controller.abort()
  await assert.rejects(importPreparedInputs({registry,getRun:()=>runId,runtime:ctx.subprocess,protectedRoots:[data],workspaceId:'test',runId,params,signal:controller.signal}))
  assert.equal(listWorkspaceFiles(workspace,runId).length,before)
  assert.equal(readdirSync(dirname(dirname(imported.pdbPath))).some(name=>name.startsWith('.upload-')),false)
  console.log('PASS mid-import run switch and cancellation publish no partial input bundle')
} finally {
  if(fiber)await fiber.dispose()
  await ctx.fiber.dispose(); rmSync(root,{recursive:true,force:true})
}
