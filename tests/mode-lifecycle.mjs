import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import Tools, { defineTool } from '@deepseek-ai/dsh-tools'
import Subprocess from '@deepseek-ai/dsh-subprocess-local'
import Fs from '@deepseek-ai/dsh-fs-local'
import * as WetFlow from '../index.js'

const dir = mkdtempSync(join(tmpdir(), 'dsh-wetflow-lifecycle-'))
process.env.DSH_WETFLOW_DATA = dir
const ctx = new Context()
try {
  ctx.provide('workspaceRegistry', { list: () => [] })
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(Tools)
  await ctx.plugin(Subprocess);await ctx.plugin(Fs)
  ctx.tools.register(defineTool({ name:'write', description:'Test ordinary file tool', parameters:{file_path:{type:'string',required:true}},
    output:{schema:{type:'string'},render:(_args,value)=>[{type:'text',text:value}]},async execute(){return 'normal file operation'} }))
  const fiber = await ctx.plugin(WetFlow)
  const assembly = await ctx.systemPrompt.assemble()
  assert.ok(assembly.sections.some(s=>s.name==='wetflow:research-policy'))
  assert.ok(assembly.contexts.some(s=>s.name==='wetflow:active-run'))
  const restoreContext=ctx.systemPrompt.suppressRuntimeContext()
  assert.ok((await ctx.systemPrompt.assemble()).contexts.some(s=>s.name==='wetflow:active-run'))
  restoreContext()
  assert.ok(ctx.tools.get('wetflow_status'))
  const call=(path)=>ctx.tools.execute({callId:'test-file',name:'write',arguments:{file_path:path},signal:new AbortController().signal})
  const blocked=await call(join(dir,'wetflow.db'));assert.equal(blocked.isError,true);assert.match(blocked.error.message,/受控服务/)
  assert.equal((await call(join(tmpdir(),'normal-file.txt'))).isError,false)
  await fiber.dispose()
  const after=await ctx.systemPrompt.assemble()
  assert.ok(!after.sections.some(s=>s.name==='wetflow:research-policy'))
  assert.ok(!after.contexts.some(s=>s.name==='wetflow:active-run'))
  assert.equal(ctx.tools.get('wetflow_status'),undefined)
  assert.equal((await call(join(dir,'wetflow.db'))).isError,false)
  console.log('PASS: activation, global prompt and context, direct-file gate, ordinary tools, and complete removal on unload.')
}finally { await ctx.fiber.dispose();rmSync(dir,{recursive:true,force:true}) }
