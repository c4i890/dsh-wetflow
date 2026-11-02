import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import fastify from 'fastify'
import { registerWorkbenchBridge } from '../web-bridge.js'
import { registerWorkspaceFileRoutes, listWorkspaceFiles } from '../workspace-files.js'

const root=await mkdtemp(join(tmpdir(),'wf-web-bridge-'))
const ctx=new Context(),app=fastify();const routes=new Map();let removed=0,run='test-run'
ctx.provide('connection',{fetch:{register:value=>{routes.set(value.path,value);return()=>{removed++}}}})
registerWorkspaceFileRoutes(app,{list:()=>[{id:'test',path:root}]},()=>run)
app.get('/api/headers',async request=>request.headers)
app.post('/api/approvals/fake',async(_request,reply)=>reply.code(403).send({error:'denied'}))
await app.ready();registerWorkbenchBridge(ctx,app,()=>run)
await new Promise(resolve=>setTimeout(resolve,25))
try{
  assert.equal(routes.get('/api/wetflow').requestBody,'buffered')
  assert.equal(routes.get('/api/wetflow-write').requestBody,'streaming')
  const send=(path,options={})=>{const endpoint=['GET','HEAD'].includes(options.method||'GET')?'/api/wetflow':'/api/wetflow-write';return routes.get(endpoint).fetch(new Request('http://localhost:12345'+endpoint+'?'+new URLSearchParams({path}),options))}
  let response=await send('/api/headers',{headers:{'x-wetflow-internal':'forged','authorization':'private','origin':'http://localhost:12345'}})
  const headers=await response.json()
  assert.equal(headers['x-wetflow-internal'],undefined);assert.equal(headers.authorization,undefined);assert.equal(headers.origin,undefined)
  const bytes=new Uint8Array(6*1024*1024+5);bytes[0]=255;bytes[bytes.length-1]=31
  response=await send('/api/workspace-files?workspaceId=test&name=input.pdb',{method:'PUT',headers:{'Content-Type':'application/octet-stream','X-WetFlow-Run':run},body:bytes})
  assert.equal(response.status,200,await response.clone().text())
  const file=await response.json();assert.deepEqual(await readFile(file.path),Buffer.from(bytes))
  response=await send('/api/workspace-files?workspaceId=test');assert.equal((await response.json()).items.length,1)
  response=await send('/api/workspace-files?workspaceId=test&name=late.pdb',{method:'PUT',headers:{'Content-Type':'application/octet-stream','X-WetFlow-Run':'old-run'},body:bytes})
  assert.equal(response.status,409);assert.equal(listWorkspaceFiles(root,run).length,1)
  for(const path of ['https://example.com/api/test','/api/../outside','/api/headers#fragment'])assert.equal((await send(path)).status,400)
  assert.equal((await send('/api/approvals/fake',{method:'POST',headers:{'x-wetflow-internal':'forged'}})).status,403)
  console.log('PASS same-origin bridge, streamed upload, stale run, path checks and private-header stripping')
}finally{await ctx.fiber.dispose();await app.close();await rm(root,{recursive:true,force:true})}
assert.equal(removed,2)
