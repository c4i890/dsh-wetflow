import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'
import {Context} from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import Tools from '@deepseek-ai/dsh-tools'
import Subprocess from '@deepseek-ai/dsh-subprocess-local'
import Fs from '@deepseek-ai/dsh-fs-local'
import * as WetFlow from '../index.js'
const root=mkdtempSync(join(tmpdir(),'wf-agent-md-')),data=join(root,'data'),workspace=join(root,'workspace');mkdirSync(workspace);process.env.DSH_WETFLOW_DATA=data
const ctx=new Context();let fiber
try{
 ctx.provide('workspaceRegistry',{list:()=>[{id:'workspace-test',path:workspace}]});await ctx.plugin(SystemPrompt);await ctx.plugin(Tools);await ctx.plugin(Subprocess);await ctx.plugin(Fs);fiber=await ctx.plugin(WetFlow)
 const fakeAgent={session:{header:{cwd:workspace}}};const call=(name,args)=>ctx.tools.execute({callId:'md-agent-test',name,arguments:args,agent:fakeAgent,signal:new AbortController().signal})
 const status=await call('wetflow_status',{});assert.equal(status.isError,false);const runId=JSON.parse(status.value).workflow.id;const dir=join(workspace,'.wetflow','files',runId,'input');mkdirSync(dir,{recursive:true});const pdb=join(dir,'a.pdb'),xml=join(dir,'a.xml')
 const py=`import openmm as m\nfrom openmm import app,unit\nfrom openmm.vec3 import Vec3\nt=app.Topology();c=t.addChain();r=t.addResidue('MOL',c);a=t.addAtom('C1',app.element.carbon,r);b=t.addAtom('C2',app.element.carbon,r);t.addBond(a,b)\ns=m.System();s.addParticle(12);s.addParticle(12);f=m.HarmonicBondForce();f.addBond(0,1,.15,1000);s.addForce(f)\nopen(${JSON.stringify(xml)},'w').write(m.XmlSerializer.serialize(s))\nwith open(${JSON.stringify(pdb)},'w') as o:app.PDBFile.writeFile(t,[Vec3(0,0,0),Vec3(.15,0,0)]*unit.nanometer,o)`;const gen=spawnSync('python3',['-c',py],{encoding:'utf8'});if(gen.status!==0)throw Error(gen.stderr)
 const launched=await call('wetflow_md_start',{runId,pdbPath:pdb,systemPath:xml,inputMode:'system',platform:'CPU',steps:100,reportEvery:20,temperatureK:300,timestepFs:1});assert.equal(launched.isError,false,JSON.stringify(launched.error));const id=JSON.parse(launched.value).id;let task
 for(let i=0;i<250;i++){const result=await call('wetflow_md_task',{runId,taskId:id});assert.equal(result.isError,false,JSON.stringify(result.error));task=JSON.parse(result.value);if(['completed','failed'].includes(task.status))break;await new Promise(r=>setTimeout(r,100))}
 assert.equal(task.status,'completed',task.error);const listed=await call('wetflow_md_tasks',{runId});assert.equal(listed.isError,false);assert.equal(JSON.parse(listed.value).items.length,1);console.log('DSH Agent tool start, polling, task output: pass')
}finally{if(fiber)await fiber.dispose();await ctx.fiber.dispose();rmSync(root,{recursive:true,force:true})}
