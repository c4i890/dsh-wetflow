import fastify from 'fastify'
import {registerWorkspaceFileRoutes,workspaceFilesContext} from '../workspace-files.js'
import {mkdtemp,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
const path=await mkdtemp(join(tmpdir(),'wf-files-test-'));const registry={list:()=>[{id:'ws-test',path}]};let run='run-a';const app=fastify();registerWorkspaceFileRoutes(app,registry,()=>run)
try {await app.listen({host:'127.0.0.1',port:0});const url='http://127.0.0.1:'+app.server.address().port;const data=Buffer.alloc(5*1024*1024+3,0x7d);data[0]=0;data[data.length-1]=255;
 for(let i=0;i<7;i++){const name=i===0?'实验.pdf':'实验'+i+'.bin';const resp=await fetch(url+'/api/workspace-files?'+new URLSearchParams({workspaceId:'ws-test',name}),{method:'PUT',headers:{'Content-Type':'application/octet-stream','X-WetFlow-Run':run},body:i===0?data:Buffer.from([i,0,255])});if(!resp.ok)throw Error('Upload failed '+await resp.text())}
 let items=(await(await fetch(url+'/api/workspace-files?workspaceId=ws-test')).json()).items;if(items.length!==7)throw Error('Missing files');let file=items.find(x=>x.name==='实验.pdf');const actual=await readFile(file.path);if(!actual.equals(data))throw Error('Binary mismatch');console.log('Seven uploads, including >5 MB binary: pass')
 const ctx=workspaceFilesContext({session:{header:{cwd:path}}},registry,run);if(!ctx.includes('实验.pdf')||!ctx.includes(file.path))throw Error('Context missing path');if(workspaceFilesContext({session:{header:{cwd:'/tmp'}}},registry,run))throw Error('Wrong workspace leakage');run='run-b';items=(await(await fetch(url+'/api/workspace-files?workspaceId=ws-test')).json()).items;if(items.length||workspaceFilesContext({session:{header:{cwd:path}}},registry,run))throw Error('Run isolation failed');const stale=await fetch(url+'/api/workspace-files?workspaceId=ws-test&name=late.txt',{method:'PUT',headers:{'Content-Type':'application/octet-stream','X-WetFlow-Run':'run-a'},body:'x'});if(stale.status!==409)throw Error('Stale run accepted');console.log('Context paths and run isolation: pass')
}finally{await app.close();await rm(path,{recursive:true,force:true})}
