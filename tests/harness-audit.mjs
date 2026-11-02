import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {Context} from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import Tools,{defineTool} from '@deepseek-ai/dsh-tools'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import LocalFs from '@deepseek-ai/dsh-fs-local'
import * as ShellEnv from '@deepseek-ai/dsh-shell-env'
import {LocalBashExecutor} from '@deepseek-ai/dsh-bash-local'
import * as ToolBash from '@deepseek-ai/dsh-tool-bash'
import * as WetFlow from '../index.js'
const root=mkdtempSync(join(tmpdir(),'wf-harness-audit-')),data=join(root,'data'),workspace=join(root,'workspace');mkdirSync(workspace);process.env.DSH_WETFLOW_DATA=data
const ctx=new Context();let fiber
try{
 ctx.provide('workspaceRegistry',{list:()=>[{id:'test',path:workspace}]});ctx.provide('workingDirectory',{ensure:async()=>workspace});await ctx.plugin(SystemPrompt);await ctx.plugin(Tools);await ctx.plugin(AgentRegistry);await ctx.plugin(LocalSubprocessRuntime);ctx.subprocess.internals={spillDir:root};await ctx.plugin(ShellEnv);await ctx.plugin(LocalBashExecutor,{timeoutMs:10000,graceMs:200});await ctx.plugin(ToolBash,{enableRunInBackground:false,promoteOnTimeout:false});
 await ctx.plugin(LocalFs);ctx.tools.register(defineTool({name:'write',description:'Test file writer',parameters:{file_path:{type:'string',required:true},content:{type:'string',required:true}},output:{schema:{type:'string'},render:(_a,v)=>[{type:'text',text:v}]},async execute(args){writeFileSync(args.file_path,args.content);return 'ok'}}));fiber=await ctx.plugin(WetFlow)
 const call=(name,args)=>ctx.tools.execute({callId:'audit-test',name,arguments:args,signal:new AbortController().signal})
 const protectedFile=join(data,'guard-test.txt'),normalFile=join(workspace,'regular.txt')
 let out=await call('write',{file_path:protectedFile,content:'hello'});console.log('Direct write into data directory blocked:',out.isError===true&&!existsSync(protectedFile))
 out=await call('write',{file_path:normalFile,content:'ordinary'});console.log('Ordinary workspace write works:',!out.isError&&readFileSync(normalFile,'utf8')==='ordinary')
 out=await call('bash',{description:'Write isolated test marker',command:`printf marker > '${protectedFile}'`,workdir:workspace});console.log('Real DSH bash bypasses WetFlow file guard:',!out.isError&&existsSync(protectedFile)&&readFileSync(protectedFile,'utf8')==='marker');if(out.isError)console.log('Bash tool error:',JSON.stringify(out.error))
 const known=ctx.tools.schemas().map(x=>x.name);console.log('WetFlow DSH measurement write tool registered:',known.some(name=>/^wetflow_.*(measurement|measure|测量)/i.test(name)))
}finally{if(fiber)await fiber.dispose();await ctx.fiber.dispose();rmSync(root,{recursive:true,force:true})}
