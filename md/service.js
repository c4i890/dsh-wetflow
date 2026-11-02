import {existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync, renameSync, copyFileSync, rmSync} from 'node:fs'
import {join,basename,dirname} from 'node:path'
import {spawn} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import {listWorkspaceFiles} from '../workspace-files.js'

const runner=join(import.meta.dirname,'runner.py')
const safeId=value=>{if(typeof value!=='string'||!/^[a-zA-Z0-9_-]+$/.test(value))throw new Error('任务或实验运行标识无效。');return value}
const number=(value,name,min,max)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new Error(`${name} 无效。`);return value}
const integer=(value,name,min,max)=>{number(value,name,min,max);if(!Number.isSafeInteger(value))throw new Error(`${name} 必须是整数。`);return value}
export class MdTaskService {
  constructor(registry, getRun, options={}){this.registry=registry;this.getRun=getRun;this.python=options.python||process.env.DSH_WETFLOW_MD_PYTHON||'python3';this.children=new Map()}
  workspace(id){const w=this.registry.list().find(x=>String(x.id)===id);if(!w)throw new Error('请先选择有效的 DSH 工作区。');return w}
  root(workspace,runId){return join(workspace.path,'.wetflow','md-tasks',safeId(runId))}
  directory(workspace,runId,id){return join(this.root(workspace,runId),safeId(id))}
  persist(dir,task){const temp=join(dir,'task.tmp');writeFileSync(temp,JSON.stringify(task,null,2));renameSync(temp,join(dir,'task.json'))}
  async platforms(){return await new Promise(resolve=>{let out='',err='';const p=spawn(this.python,['-c',"import json,openmm; print(json.dumps({'version':openmm.__version__,'platforms':[openmm.Platform.getPlatform(i).getName() for i in range(openmm.Platform.getNumPlatforms())]}))"],{stdio:['ignore','pipe','pipe']});p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);p.on('error',e=>resolve({available:false,error:e.message}));p.on('close',code=>{try{resolve(code===0?{available:true,...JSON.parse(out)}:{available:false,error:err.trim()||'OpenMM 不可用'})}catch{resolve({available:false,error:'无法识别 OpenMM 环境。'})}})})}
  list(workspaceId,runId){const w=this.workspace(workspaceId);if(this.getRun()!==runId)throw new Error('实验运行已切换。');const root=this.root(w,runId);if(!existsSync(root))return [];return readdirSync(root,{withFileTypes:true}).filter(x=>x.isDirectory()&&!x.name.startsWith('.')).map(x=>{try{return this.get(workspaceId,runId,x.name)}catch{return null}}).filter(Boolean).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))}
  get(workspaceId,runId,id){const w=this.workspace(workspaceId);if(this.getRun()!==runId)throw new Error('实验运行已切换。');const path=this.directory(w,runId,id);const task=JSON.parse(readFileSync(join(path,'task.json'),'utf8'));if(['queued','running','preparing','minimizing','cancelling'].includes(task.status)&&!this.children.has(task.id)){task.status='interrupted';task.error='运行进程已停止；请重新提交任务。';this.persist(path,task)}return task}
  start(workspaceId,runId,params){
    const w=this.workspace(workspaceId);if(this.getRun()!==runId)throw new Error('实验运行已切换。')
    const files=listWorkspaceFiles(w.path,runId);const lookup=(path,label)=>{const f=files.find(x=>x.path===path);if(!f)throw new Error(`请选择当前实验运行中导入的${label}。`);return f.path}
    const pdb=lookup(params.pdbPath,'PDB 文件'),mode=params.inputMode||'system',system=mode==='system'?lookup(params.systemPath,'OpenMM System XML 文件'):undefined
    if(!['system','amber14'].includes(mode))throw new Error('输入模式无效。')
    let preparation
    for(const input of [pdb,system].filter(Boolean)) {
      const manifest=join(dirname(input),'wetflow-preparation.json')
      if(!existsSync(manifest))continue
      const record=JSON.parse(readFileSync(manifest,'utf8'))
      if(record.kind!=='wetflow-md-preparation')continue
      if(record.runId!==runId||record.workspaceId!==workspaceId||record.inputMode!==mode
        ||join(dirname(input),record.files.pdb)!==pdb
        ||mode==='system'&&join(dirname(input),record.files.system)!==system)
        throw new Error('准备输入不属于同一次导入，请使用 wetflow_md_import_inputs 返回的配套结构与参数。')
      preparation={...record,manifestPath:manifest,scriptPath:join(dirname(input),record.files.script)}
    }
    const settings={inputMode:mode,platform:params.platform||'CPU',temperatureK:number(params.temperatureK??300,'温度',1,5000),frictionPerPs:number(params.frictionPerPs??1,'摩擦系数',0.00001,10000),timestepFs:number(params.timestepFs??2,'时间步长',0.00001,100),steps:integer(params.steps??1000,'步数',1,Number.MAX_SAFE_INTEGER),reportEvery:integer(params.reportEvery??100,'输出间隔',1,Number.MAX_SAFE_INTEGER),minimizeIterations:integer(params.minimizeIterations??100,'最小化迭代数',0,1000000),seed:integer(params.seed??2026,'随机种子',1,2147483647),ph:number(params.ph??7,'pH',0,14),solvate:params.solvate===true,paddingNm:number(params.paddingNm??1,'溶剂边界',0.1,100)}
    if(settings.reportEvery>settings.steps)throw new Error('输出间隔不能大于总步数。')
    if(!['CPU','Reference','CUDA','OpenCL'].includes(settings.platform))throw new Error('计算平台无效。')
    if(mode==='system'&&settings.solvate)throw new Error('已参数化 System 不能再自动加溶剂。')
    const root=this.root(w,runId);mkdirSync(root,{recursive:true});const realRoot=realpathSync(root),realWorkspace=realpathSync(w.path);if(!(realRoot===realWorkspace||realRoot.startsWith(realWorkspace+'/')))throw new Error('任务目录不在工作区内。')
    const id='md-'+randomUUID(),dir=join(realRoot,id);mkdirSync(dir,{mode:0o700});let task
    try{copyFileSync(pdb,join(dir,'input.pdb'));if(system)copyFileSync(system,join(dir,'input-system.xml'));task={id,runId,workspaceId,status:'queued',createdAt:new Date().toISOString(),inputPdb:basename(pdb),...(system?{inputSystem:basename(system)}:{}),...(preparation?{preparation}:{}),settings,outputDirectory:dir,stepsDone:0,stepsTotal:settings.steps};this.persist(dir,task)}catch(e){rmSync(dir,{recursive:true,force:true});throw e}
    const child=spawn(this.python,[runner],{stdio:['pipe','pipe','pipe'],shell:false,env:{...process.env,OPENMM_CPU_THREADS:process.env.OPENMM_CPU_THREADS||'2'}});child.wfTask=task;this.children.set(id,child);let buffer='',stderr='';let settled=false
    const save=()=>{try{this.persist(dir,task)}catch(e){console.error('[dsh-wetflow] MD task state write failed:',e.message)}}
    const finish=(status,error)=>{if(settled)return;settled=true;this.children.delete(id);task.status=status;task.finishedAt=new Date().toISOString();if(error)task.error=error;save()}
    child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{buffer+=chunk;let p;while((p=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,p);buffer=buffer.slice(p+1);try{const update=JSON.parse(line);if(update.stage==='failed'){task.error=update.error}else if(update.stage==='completed'){task.result=update.result}else{task.status=update.stage;Object.assign(task,update);delete task.stage}save()}catch{}}})
    child.stderr.setEncoding('utf8');child.stderr.on('data',x=>{stderr=(stderr+x).slice(-12000)})
    child.on('error',e=>finish('failed',e.message));child.on('close',(code,signal)=>{if(task.cancelRequested)finish('cancelled');else if(code===0&&task.result)finish('completed');else finish('failed',task.error||stderr.trim()||`进程退出：${code??signal}`)})
    child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({...settings,outputDirectory:dir}));return task
  }
  cancel(workspaceId,runId,id){const task=this.get(workspaceId,runId,id),child=this.children.get(id);if(!child)throw new Error('该任务当前没有运行。');const live=child.wfTask;live.cancelRequested=true;live.status='cancelling';this.persist(this.directory(this.workspace(workspaceId),runId,id),live);child.kill('SIGTERM');return live}
  close(){for(const child of this.children.values())child.kill('SIGTERM')}
}
export function registerMdTaskRoutes(app,service){
  const respond=(reply,fn)=>{try{return fn()}catch(e){return reply.code(400).send({error:e.message||'操作失败。'})}}
  app.get('/api/wetflow-md/platforms',async()=>service.platforms())
  app.get('/api/wetflow-md/tasks',(req,reply)=>respond(reply,()=>({items:service.list(req.query.workspaceId,req.query.runId)})))
  app.get('/api/wetflow-md/tasks/:id',(req,reply)=>respond(reply,()=>service.get(req.query.workspaceId,req.query.runId,req.params.id)))
  app.post('/api/wetflow-md/tasks',(req,reply)=>respond(reply,()=>service.start(req.body?.workspaceId,req.body?.runId,req.body?.parameters||{})))
  app.post('/api/wetflow-md/tasks/:id/cancel',(req,reply)=>respond(reply,()=>service.cancel(req.body?.workspaceId,req.body?.runId,req.params.id)))
}
