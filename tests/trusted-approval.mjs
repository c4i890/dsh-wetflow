import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {Context} from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import Tools from '@deepseek-ai/dsh-tools'
import Subprocess from '@deepseek-ai/dsh-subprocess-local'
import Fs from '@deepseek-ai/dsh-fs-local'
import * as WetFlow from '../index.js'
const root=mkdtempSync(join(tmpdir(),'wf-approval-')),data=join(root,'data'),workspace=join(root,'ws');mkdirSync(workspace);process.env.DSH_WETFLOW_DATA=data;process.env.DSH_WETFLOW_PORT='14318'
let decision='rejected', prompts=0, shown='';const ctx=new Context();let fiber
try{
 ctx.provide('workspaceRegistry',{list:()=>[{id:'ws',path:workspace}]})
 ctx.provide('approval',{request:async req=>{prompts++;shown=req.reason;const snapshot=await(await fetch('http://127.0.0.1:14318/api/snapshot')).json();const pending=snapshot.approvals.find(x=>x.status==='PENDING');if(pending){const response=await fetch(`http://127.0.0.1:14318/api/approvals/${pending.id}`,{method:'POST',headers:{'Content-Type':'application/json','Origin':'http://127.0.0.1:4321'},body:JSON.stringify({decision:'approve'})});assert.equal(response.status,403)}return decision}})
 await ctx.plugin(SystemPrompt);await ctx.plugin(Tools);await ctx.plugin(Subprocess);await ctx.plugin(Fs);fiber=await ctx.plugin(WetFlow)
 const fakeAgent={session:{header:{cwd:workspace}}};const call=(name,args)=>ctx.tools.execute({callId:'approval-test',name,arguments:args,agent:fakeAgent,signal:new AbortController().signal})
 const before=JSON.parse((await call('wetflow_status',{})).value),runId=before.workflow.id
 let res=await call('wetflow_propose_plan',{runId,stagesJson:JSON.stringify([{key:'DESIGN',label:'设计',description:'整理资料'},{key:'TEST',label:'检测',description:'检测样本'}])});assert.equal(res.isError,false,JSON.stringify(res.error));assert.equal(JSON.parse(res.value).decision,'rejected');assert.equal(JSON.parse((await call('wetflow_status',{})).value).workflow.currentStage,'DRAFT')
 decision='allowed-once';res=await call('wetflow_propose_plan',{runId,stagesJson:JSON.stringify([{key:'DESIGN',label:'设计',description:'整理资料'},{key:'TEST',label:'检测',description:'检测样本'}])});assert.equal(res.isError,false,JSON.stringify(res.error));assert.equal(JSON.parse(res.value).decision,'approved');assert.equal(JSON.parse((await call('wetflow_status',{})).value).workflow.currentStage,'DESIGN');console.log('Native-approval adapter: rejected stays put; explicit grant advances; forged HTTP denied')
 let params=await call('wetflow_measurement_parameters',{runId});assert.equal(params.isError,false,JSON.stringify(params.error))
 decision='rejected';res=await call('wetflow_define_measurement_parameter',{runId,key:'TEMP',name:'温度',unit:'°C'});assert.equal(JSON.parse(res.value).status,'rejected');assert.equal(JSON.parse((await call('wetflow_measurement_parameters',{runId})).value).parameters.length,0)
 decision='allowed-once';res=await call('wetflow_define_measurement_parameter',{runId,key:'TEMP',name:'温度',unit:'°C'});assert.equal(res.isError,false,JSON.stringify(res.error));assert.equal(JSON.parse(res.value).status,'created');res=await call('wetflow_define_measurement_parameter',{runId,key:'TEMP',name:'温度',unit:'K'});assert.equal(res.isError,true)
 const promptCount=prompts;res=await call('wetflow_record_measurement',{runId,parameterKey:'TEMP',value:30,unit:'K'});assert.equal(res.isError,true);assert.equal(prompts,promptCount)
 decision='rejected';res=await call('wetflow_record_measurement',{runId,parameterKey:'TEMP',value:30,unit:'°C'});assert.equal(res.isError,false,JSON.stringify(res.error));assert.equal(JSON.parse(res.value).status,'rejected');assert.equal(JSON.parse((await call('wetflow_measurements',{runId})).value).points.length,0)
 decision='allowed-once';res=await call('wetflow_record_measurement',{runId,parameterKey:'TEMP',value:30,unit:'°C'});assert.equal(res.isError,false,JSON.stringify(res.error));assert.equal(JSON.parse(res.value).status,'recorded');assert.match(shown,/30 °C/);assert.equal(JSON.parse((await call('wetflow_measurements',{runId})).value).points.length,1)
 const forged=await fetch('http://127.0.0.1:14318/api/industrial/telemetry',{method:'POST',headers:{'Content-Type':'application/json','Origin':'http://127.0.0.1:4321','x-wetflow-internal':'fake'},body:JSON.stringify({runId,parameterKey:'TEMP',value:31,unit:'°C'})});assert.equal(forged.status,403);assert.equal(JSON.parse((await call('wetflow_measurements',{runId})).value).points.length,1)
 console.log('Unit mismatch rejected; user rejection records nothing; approval records once; forged API denied')
}finally{if(fiber)await fiber.dispose();await ctx.fiber.dispose();rmSync(root,{recursive:true,force:true})}
