import { homedir } from 'node:os'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { createServer } from './wetflow/dist/node/server.js'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { protectedFileToolGuard } from './guards.js'
import { registerWorkspaceFileRoutes, workspaceFilesContext } from './workspace-files.js'
import { compareMdReport, registerMdRoutes } from './biology-tools.js'
import { MdTaskService, registerMdTaskRoutes } from './md/service.js'
import { importPreparedInputs } from './md/prepared-inputs.js'
import { requestUserApproval } from './trusted-approval.js'
import { installProcessGate } from './process-gate.js'
import { registerWorkbenchBridge } from './web-bridge.js'

export const name = 'dsh-wetflow'
export const inject = ['tools', 'systemPrompt', 'workspaceRegistry', 'subprocess', 'fs']

export async function apply(ctx) {
  if (process.platform !== 'linux') throw new Error('DSH–WetFlow 预览版目前支持 Linux／WSL。请在 Linux 或 WSL 中启动 DSH。')
  const data = process.env.DSH_WETFLOW_DATA || join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'wetflow')
  mkdirSync(data, { recursive: true, mode: 0o700 })
  const processGate=await installProcessGate(ctx,data)
  const app = await createServer({
    dbPath: join(data, 'wetflow.db'), settingsPath: join(data, 'model-settings.json'),
    industrialDbPath: join(data, 'industrial.db'), industrialSettingsPath: join(data, 'industrial-settings.json'),
    researchDbPath: join(data, 'research.db'), modelingDataDir: join(data, 'modeling'),
    plugins: ['evidence', 'workflow-planner', 'local-files', 'document-media', 'research', 'modeling', 'feed-comparison', 'experiment'],
    serveWeb: false,
  })
  const internalAuthority=randomBytes(32).toString('base64url')
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin
    const path=request.url.split('?')[0]
    if(/^\/api\/plugins\/.*probe$/.test(path))return reply.code(403).send({error:'演示自检入口不向通用工具开放。'})
    const controlled=/^\/api\/approvals\//.test(path)||path.startsWith('/api/industrial/')||['/api/chat','/api/wake','/api/model-settings'].includes(path)||path.startsWith('/api/plugins/')||/^\/api\/modeling\/tasks\/[^/]+\/experiment$/.test(path)
    if(request.method!=='GET' && request.method!=='OPTIONS' && controlled && request.headers['x-wetflow-internal']!==internalAuthority) return reply.code(403).send({error:'此操作须通过 DSH 用户审批和受控工具。'})
    if (origin) return reply.code(403).send({ error: '请通过已登录的 DSH 工作台访问。' })
  })
  app.options('/*', async (_request, reply) => reply.code(204).send())
  app.get('/api/wetflow-security',async()=>processGate.state)
  registerWorkspaceFileRoutes(app, ctx.workspaceRegistry, () => app.wetflowAgent.snapshot().workflow.id)
  registerMdRoutes(app, ctx.workspaceRegistry, () => app.wetflowAgent.snapshot().workflow.id)
  const mdTasks=new MdTaskService(ctx.workspaceRegistry,()=>app.wetflowAgent.snapshot().workflow.id)
  registerMdTaskRoutes(app,mdTasks)
  ctx.effect(()=>()=>mdTasks.close(),'Stop MD workers')
  // Normal use opens no second network listener. Isolated integration tests can
  // opt into a loopback listener in their temporary DSH_WETFLOW_DATA directory.
  const servicePort=process.env.DSH_WETFLOW_PORT === undefined ? undefined : Number(process.env.DSH_WETFLOW_PORT)
  if(servicePort !== undefined && (!Number.isInteger(servicePort)||servicePort<1||servicePort>65535))throw new Error('DSH_WETFLOW_PORT 无效。')
  try { if(servicePort !== undefined) await app.listen({host:'127.0.0.1',port:servicePort}); else await app.ready() }
  catch (error) { await app.close(); throw error }
  ctx.effect(() => () => app.close(), 'Close WetFlow workbench')
  const agent = app.wetflowAgent
  registerWorkbenchBridge(ctx,app,()=>agent.snapshot().workflow.id)
  ctx.tools.guard(execution => protectedFileToolGuard(data, execution))
  // Apply WetFlow guidance at the Harness level, not only inside the panel.
  ctx.systemPrompt.section({
    name: 'wetflow:research-policy', order: 850, interpolate: false,
    text: `WetFlow 生物研究工作模式已开启。所有会话和 Agent 都应使用当前工作台的项目与实验运行上下文。处理实验问题前读取 wetflow_status；当前工作区资料按上下文给出的路径使用文件工具按需读取，原证据库资料使用 wetflow_search_evidence 检索，均保留来源；不要把文献参数当作实际测量。流程待定时与用户商讨，调用 wetflow_propose_plan 提出路线；只能用 wetflow_propose_advance 请求下一阶段，等待研究人员在 DSH 确认卡片中批准。对于写入测量、修改实验记录或其他影响实验的操作，须经过相应的受控工具、校验和明确审批；不得通过其他工具绕过。一般问答和只读分析不需要审批。普通命令在独立沙盒中执行：可读写当前普通工作区，已导入资料和受控结果只读，实验数据库不可直接访问；命令可以通过自动配置的 HTTP(S) 代理访问公网；本机地址、私有地址及非 80/443 端口仍被隔离。依赖安装到当前工作区或其虚拟环境，避免全局安装；联网文献任务也可使用 WetFlow Research 工具。`,
  })
  ctx.systemPrompt.context({
    name: 'wetflow:active-run', order: 130, interpolate: false, required: true,
    text: () => {
      const snapshot = agent.snapshot()
      const workflow = snapshot.workflow
      return `WetFlow 生物研究模式：实验资料须保留来源；实际测量和实验阶段变更须经受控工具校验并等待用户审批。当前上下文：${JSON.stringify({projectId: workflow.projectId, project: workflow.project, runId: workflow.id, run: workflow.name, status: workflow.status, currentStage: workflow.currentStage, plan: workflow.plan ?? {status:'pending',stages:[]}, pendingApprovals: snapshot.approvals.filter(a => a.status === 'PENDING').length})}`
    },
  })
  ctx.systemPrompt.context({name:'wetflow:workspace-files',order:131,interpolate:false,required:true,text: context => workspaceFilesContext(context.scope,ctx.workspaceRegistry,agent.snapshot().workflow.id)})
  ctx.systemPrompt.section({
    name: 'wetflow:md-preparation', order: 851, interpolate: false,
    text: '准备分子动力学输入时，可以使用普通文件工具在当前工作区（.wetflow 之外）编写和修改准备脚本，并通过 Bash 在沙盒内运行。准备脚本执行完成后，调用 wetflow_md_import_inputs，提交生成的 PDB、System XML（system 模式）及准备脚本路径，保存本次输入与脚本副本。导入只检查文件与基本结构一致性，不证明参数科学有效；说明力场、单位和建模假设，不虚构参数来源。随后使用导入工具返回的路径调用 wetflow_md_start，并查看任务状态。修订脚本后重新生成、重新导入，不能覆盖旧输入或旧结果。',
  })
  const result = { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] }
  const add = (name, description, parameters, fn) => ctx.tools.register(defineTool({ name, description, parameters, output: result,
    async execute(args, exec) { return JSON.stringify(await fn(args, exec)) } }))
  const guard = (runId) => {
    const actual = agent.snapshot().workflow.id
    if (runId !== actual) throw new Error('活动实验运行已改变，请重新调用 wetflow_status 确认。')
  }
  const run = { type: 'string', required: true, description: '从 wetflow_status 得到的当前实验运行 ID。' }
  add('wetflow_status', '查看生物工作台当前项目、实验运行、阶段和待审批提案。先调用此工具确认当前实验。', {}, async () => {
    const snapshot = agent.snapshot()
    return { workflow: snapshot.workflow, approvals: snapshot.approvals.filter(a => a.status === 'PENDING'), sources: agent.store.evidenceSources() }
  })
  add('wetflow_search_evidence', '检索当前实验运行已导入的资料，返回带来源的片段；不同运行的资料相互隔离。', {
    runId: run, query: { type: 'string', required: true, description: '要查找的资料关键词。' }
  }, async args => {
    guard(args.runId)
    return await agent.tools.get('evidence_search').execute({ query: args.query, limit: 4 })
  })
  add('wetflow_research_search', '在 Europe PMC、arXiv 或 NCBI GEO 检索公开文献或数据集，后台保存当前实验运行的来源。返回任务 ID，之后调用 wetflow_research_jobs 查询状态。', {
    runId: run, query: {type:'string',required:true,description:'检索关键词'}, provider:{type:'string',required:true,description:'数据源：europepmc、arxiv 或 geo'}
  }, async args => { guard(args.runId);return await agent.tools.get('research_search').execute({runId:args.runId,query:args.query,providers:[args.provider],limit:10}) })
  add('wetflow_research_jobs', '查看当前实验运行的公开数据检索任务、状态与错误。', {runId:run}, async args=>{guard(args.runId);return await agent.tools.get('research_jobs').execute({runId:args.runId})})
  add('wetflow_research_sources', '查看当前实验运行保存的文献或数据集来源；元数据和摘要不等同于全文。', {runId:run}, async args=>{guard(args.runId);return await agent.tools.get('research_sources').execute({runId:args.runId})})
  add('wetflow_research_fetch', '获取当前实验运行中指定来源的可访问正文或摘要，返回实际获取层级。', {runId:run,sourceId:{type:'string',required:true,description:'来源 ID'}}, async args=>{guard(args.runId);return await agent.tools.get('research_fetch_source').execute({runId:args.runId,sourceId:args.sourceId})})
  add('wetflow_research_read', '分页阅读当前运行已经获取的来源内容，保留来源与层级。', {runId:run,sourceId:{type:'string',required:true,description:'来源 ID'},offset:{type:'number',description:'起始位置'}}, async args=>{guard(args.runId);return await agent.tools.get('research_source_read').execute({runId:args.runId,sourceId:args.sourceId,offset:args.offset??0})})
  add('wetflow_research_records', '查看当前实验运行中具有来源和位置的文献数据记录。', {runId:run}, async args=>{guard(args.runId);return await agent.tools.get('research_records').execute({runId:args.runId})})
  add('wetflow_research_schema', '查看当前运行的文献研究数据库可查询的只读表与字段。', {runId:run}, async args=>{guard(args.runId);return await agent.tools.get('research_schema').execute({runId:args.runId})})
  add('wetflow_research_query', '在当前实验运行范围内对已保存文献资料执行只读 SQL 查询。', {runId:run,sql:{type:'string',required:true,description:'只读 SELECT 语句'}}, async args=>{guard(args.runId);return await agent.tools.get('research_query').execute({runId:args.runId,sql:args.sql})})
  add('wetflow_research_record_add', '保存有精确原文和定位的文献数据记录；只接受可核对的全文或数据集，不能作为团队实际测量。recordJson 包含 sourceId、metric、unit、points、timeUnit、evidenceQuote、locator。', {runId:run,recordJson:{type:'string',required:true,description:'文献数据记录 JSON 对象'}}, async args=>{guard(args.runId);const record=JSON.parse(args.recordJson);if(!record||typeof record!=='object'||Array.isArray(record))throw new Error('文献记录必须是 JSON 对象。');return await agent.tools.get('research_record_add').execute({...record,runId:args.runId})})
  add('wetflow_md_compare', '比较当前运行已有的 PMA–DA MD 接触汇总 JSON 文件中的两组投料条件；检查共同活化率、时间窗口与接触计数。未提供报告路径时使用内置示例。本工具不运行新的分子动力学模拟。', {
    runId:run, reportPath:{type:'string',description:'工作区资料中 MD 汇总 JSON 的完整路径；不填使用内置示例'}, baselineFeed:{type:'number',required:true,description:'基准投料比'},comparisonFeed:{type:'number',required:true,description:'比较投料比'}
  },async(args,exec)=>{
    guard(args.runId)
    const cwd=exec.agent?.session?.header?.cwd
    const workspace=ctx.workspaceRegistry.list().find(item=>item.path===cwd)
    return compareMdReport({registry:ctx.workspaceRegistry,workspaceId:String(workspace?.id??''),runId:args.runId,reportPath:args.reportPath,baselineFeed:args.baselineFeed,comparisonFeed:args.comparisonFeed})
  })
  const workspaceForAgent = exec => {
    const cwd=exec.agent?.session?.header?.cwd
    const workspace=ctx.workspaceRegistry.list().find(item=>item.path===cwd)
    if(!workspace)throw new Error('请先在 DSH 选择工作区。')
    return String(workspace.id)
  }
  add('wetflow_md_platforms', '检查当前环境安装的 OpenMM 版本和可用计算平台。', {}, async()=>mdTasks.platforms())
  add('wetflow_md_import_inputs', '将当前普通工作区中准备脚本生成的 MD 输入导入当前实验运行。保存 PDB、System XML 和准备脚本的独立副本，校验文件与原子数等基本一致性，返回可直接用于 wetflow_md_start 的路径。本工具不执行准备脚本、不启动模拟、不改写旧结果。', {
    runId: run,
    inputMode: {type:'string',required:true,description:'system 或 amber14；非标准分子需由准备脚本提供适用的参数化 System'},
    pdbPath: {type:'string',required:true,description:'普通工作区中新生成的 .pdb 文件路径，支持相对工作区的路径'},
    systemPath: {type:'string',description:'system 模式必填：准备脚本生成的 OpenMM System .xml 路径'},
    preparationScriptPath: {type:'string',required:true,description:'生成这些输入的准备脚本路径；只保存副本，不在受控服务中执行'},
    notes: {type:'string',description:'本次准备所用的力场、参数来源、假设和修改说明'},
  }, async(args,exec)=>{
    guard(args.runId)
    return importPreparedInputs({registry:ctx.workspaceRegistry,getRun:()=>agent.snapshot().workflow.id,
      runtime:ctx.subprocess,python:mdTasks.python,protectedRoots:[data,process.env.DSH_HOME||join(homedir(),'.dsh'),import.meta.dirname],
      workspaceId:workspaceForAgent(exec),runId:args.runId,params:args,signal:exec.signal})
  })
  add('wetflow_md_start', '在当前 DSH 工作区启动 OpenMM 分子动力学任务：使用当前运行已导入的 PDB，以及 OpenMM System XML（system 模式）或 Amber14 标准力场（amber14 模式）。保存准备结构、轨迹、状态和结果；不模拟化学成键。先确认体系、输入、参数和用户的运行意图。', {
    runId:run, pdbPath:{type:'string',required:true,description:'当前运行工作区资料中的 PDB 完整路径'}, systemPath:{type:'string',description:'system 模式的 OpenMM System XML 完整路径'}, inputMode:{type:'string',required:true,description:'system 或 amber14'}, platform:{type:'string',required:true,description:'CPU、Reference、CUDA 或 OpenCL'}, steps:{type:'integer',required:true,description:'动力学步数'},reportEvery:{type:'integer',required:true,description:'轨迹和状态输出步数间隔'},temperatureK:{type:'number',required:true,description:'温度，K'},timestepFs:{type:'number',required:true,description:'时间步长，fs'},solvate:{type:'boolean',description:'amber14 模式是否添加 TIP3P 水盒'},paddingNm:{type:'number',description:'水盒最小边距，nm'},ph:{type:'number',description:'加氢采用的 pH'}
  },async(args,exec)=>{guard(args.runId);return mdTasks.start(workspaceForAgent(exec),args.runId,args)})
  add('wetflow_md_tasks', '查看当前工作区和实验运行中的 MD 任务及状态和结果路径。', {runId:run},async(args,exec)=>{guard(args.runId);return {items:mdTasks.list(workspaceForAgent(exec),args.runId)}})
  add('wetflow_md_task', '查看一个 MD 任务的进度、错误或结果。', {runId:run,taskId:{type:'string',required:true,description:'任务 ID'}},async(args,exec)=>{guard(args.runId);return mdTasks.get(workspaceForAgent(exec),args.runId,args.taskId)})
  add('wetflow_md_cancel', '取消当前工作区和实验运行中正在执行的 MD 任务。', {runId:run,taskId:{type:'string',required:true,description:'任务 ID'}},async(args,exec)=>{guard(args.runId);return mdTasks.cancel(workspaceForAgent(exec),args.runId,args.taskId)})
  async function approvedWorkflow(name,args,exec) {
    if(!exec.agent||!ctx.get('approval'))throw new Error('DSH 用户审批通道不可用，未创建提案。')
    const proposed=agent.requestExternalApproval(name,args)
    agent.events.emit('event',{type:'snapshot',snapshot:agent.snapshot()})
    let allowed
    try { allowed=await requestUserApproval(ctx,exec,proposed.summary) }
    catch(error) { try{await agent.decide(proposed.id,'reject')}catch{};throw error }
    if(allowed)guard(proposed.workflowRunId)
    await agent.decide(proposed.id,allowed?'approve':'reject')
    agent.events.emit('event',{type:'snapshot',snapshot:agent.snapshot()})
    return {approvalId:proposed.id,decision:allowed?'approved':'rejected',workflow:agent.snapshot().workflow}
  }
  add('wetflow_review_pending','对当前实验运行遗留的待审批流程提案发起 DSH 用户审批；未经用户批准不会执行。',{
    runId:run,approvalId:{type:'string',required:true,description:'当前运行待审批的提案 ID'}
  },async(args,exec)=>{
    guard(args.runId)
    const item=agent.snapshot().approvals.find(a=>a.id===args.approvalId&&a.status==='PENDING'&&a.workflowRunId===args.runId)
    if(!item)throw new Error('当前运行没有该待审批提案。')
    const allowed=await requestUserApproval(ctx,exec,item.summary)
    guard(args.runId)
    await agent.decide(item.id,allowed?'approve':'reject')
    agent.events.emit('event',{type:'snapshot',snapshot:agent.snapshot()})
    return {approvalId:item.id,decision:allowed?'approved':'rejected',workflow:agent.snapshot().workflow}
  })
  add('wetflow_measurement_parameters','查看当前实验运行中已定义的测量参数和单位。',{runId:run},async args=>{guard(args.runId);return await agent.tools.get('industrial_parameter_list').execute({runId:args.runId})})
  add('wetflow_measurements','查看当前实验运行已记录的测量值。',{runId:run},async args=>{guard(args.runId);return await agent.tools.get('industrial_telemetry_list').execute({runId:args.runId})})
  add('wetflow_define_measurement_parameter','提出新增测量参数、单位及可选范围，须经用户确认；不能修改已有参数。',{
    runId:run,key:{type:'string',required:true,description:'新参数键'},name:{type:'string',required:true,description:'参数名称'},unit:{type:'string',required:true,description:'测量单位'},lowerLimit:{type:'number',description:'可选下限'},upperLimit:{type:'number',description:'可选上限'}
  },async(args,exec)=>{
    guard(args.runId)
    if(!args.key.trim()||!args.name.trim()||!args.unit.trim())throw new Error('参数键、名称和单位均不能为空。')
    if(args.lowerLimit!==undefined&&!Number.isFinite(args.lowerLimit)||args.upperLimit!==undefined&&!Number.isFinite(args.upperLimit)||args.lowerLimit!==undefined&&args.upperLimit!==undefined&&args.lowerLimit>args.upperLimit)throw new Error('参数范围无效。')
    const existing=await agent.tools.get('industrial_parameter_list').execute({runId:args.runId})
    if(existing.parameters.some(p=>p.key===args.key))throw new Error('该参数已存在，不能通过此工具修改。')
    const description=`是否新增测量参数？\n${args.name} (${args.key})，单位：${args.unit}\n下限：${args.lowerLimit??'未指定'}；上限：${args.upperLimit??'未指定'}\n运行：${args.runId}`
    if(!await requestUserApproval(ctx,exec,description))return {status:'rejected',message:'用户拒绝或取消，未新增参数。'}
    guard(args.runId)
    const current=await agent.tools.get('industrial_parameter_list').execute({runId:args.runId})
    if(current.parameters.some(p=>p.key===args.key))throw new Error('参数在审批期间已存在，请重新确认。')
    const response=await app.inject({method:'POST',url:'/api/industrial/parameters',headers:{'x-wetflow-internal':internalAuthority,'x-wetflow-actor':'dsh-approved-user','x-wetflow-role':'operator'},payload:{runId:args.runId,key:args.key,name:args.name,unit:args.unit,lowerLimit:args.lowerLimit,upperLimit:args.upperLimit}})
    if(response.statusCode!==200&&response.statusCode!==201)throw new Error(response.json().error||'参数定义失败。')
    return {status:'created',parameter:response.json()}
  })
  add('wetflow_record_measurement','提出一条明确测量记录；参数必须已定义，提供数值与单位，获得用户在 DSH 审批后才会写入。',{
    runId:run,parameterKey:{type:'string',required:true,description:'已定义参数键'},value:{type:'number',required:true,description:'用户提供的明确数值'},unit:{type:'string',required:true,description:'用户提供的单位'},reason:{type:'string',description:'测量记录来源'}
  },async(args,exec)=>{
    guard(args.runId)
    if(!Number.isFinite(args.value)||Math.abs(args.value)>1e12||!args.unit.trim())throw new Error('需要明确、有效的测量值和单位。')
    const definitions=await agent.tools.get('industrial_parameter_list').execute({runId:args.runId,key:args.parameterKey})
    const param=definitions.parameter
    if(!param)throw new Error('参数未定义。')
    if(param.unit&&param.unit.trim()!==args.unit.trim())throw new Error(`单位不匹配：参数要求 ${param.unit}。`)
    const reason=`是否记录测量？\n参数：${param.name} (${args.parameterKey})\n测量：${args.value} ${args.unit}\n运行：${args.runId}\n来源：${args.reason||'未填写'}`
    const allowed=await requestUserApproval(ctx,exec,reason)
    if(!allowed)return {status:'rejected',message:'用户拒绝或取消，未写入。'}
    guard(args.runId)
    const response=await app.inject({method:'POST',url:'/api/industrial/telemetry',headers:{'x-wetflow-internal':internalAuthority,'x-wetflow-actor':'dsh-approved-user','x-wetflow-role':'operator'},payload:{runId:args.runId,parameterKey:args.parameterKey,value:args.value,unit:args.unit,reason:args.reason||''}})
    if(response.statusCode!==200&&response.statusCode!==201)throw new Error(response.json().error||'测量写入失败。')
    return {status:'recorded',...response.json()}
  })
  add('wetflow_propose_plan', '与用户商讨之后提出实验路线；调用后只产生待审批提案，用户需在生物工作台批准。传入由 key、label、description 组成的阶段 JSON 数组。', {
    runId: run, stagesJson: { type: 'string', required: true, description: '阶段数组 JSON；key 为大写字母数字下划线，label 为名称，description 为阶段目标。' }
  }, async (args,exec) => {
    guard(args.runId)
    const stages = JSON.parse(args.stagesJson)
    return approvedWorkflow('workflow_set_plan',{stages},exec)
  })
  add('wetflow_propose_advance', '提出推进到已确认流程中的下一阶段；只创建待审批提案，不能自行推进。', {
    runId: run, nextStage: { type: 'string', required: true, description: '下一阶段的 key，必须与当前已确认路线一致。' }
  }, async (args,exec) => {
    guard(args.runId)
    const snapshot = agent.snapshot()
    const stages = snapshot.workflow.plan?.stages ?? []
    const current = stages.findIndex(stage => stage.key === snapshot.workflow.currentStage)
    if (current < 0 || stages[current + 1]?.key !== args.nextStage) throw new Error('目标不是当前流程的下一阶段。')
    return approvedWorkflow('workflow_advance',{stage:args.nextStage},exec)
  })
  const expected = ['wetflow_status', 'wetflow_search_evidence', 'wetflow_propose_plan', 'wetflow_propose_advance', 'wetflow_research_search', 'wetflow_research_jobs', 'wetflow_research_sources', 'wetflow_research_fetch', 'wetflow_research_read', 'wetflow_research_records', 'wetflow_research_schema', 'wetflow_research_query', 'wetflow_research_record_add', 'wetflow_md_compare', 'wetflow_md_platforms', 'wetflow_md_import_inputs', 'wetflow_md_start', 'wetflow_md_tasks', 'wetflow_md_task', 'wetflow_md_cancel', 'wetflow_measurement_parameters', 'wetflow_measurements', 'wetflow_define_measurement_parameter', 'wetflow_record_measurement', 'wetflow_review_pending']
  const names = ctx.tools.schemas().map(tool => tool.name)
  if (expected.some(name => !names.includes(name))) throw new Error('WetFlow tools did not register successfully')
  console.log('[dsh-wetflow] Registered project, research and MD tools.')
  if (process.env.DSH_WETFLOW_SELFTEST === '1' || process.env.DSH_WETFLOW_SELFTEST === 'isolated') {
    const result = await ctx.tools.execute({ callId: 'wetflow-startup-check', name: 'wetflow_status', arguments: {}, signal: new AbortController().signal })
    if (result.isError || typeof result.value !== 'string' || !JSON.parse(result.value).workflow?.id) throw new Error('WetFlow DSH tool execution check failed')
    console.log('[dsh-wetflow] DSH tool execution check passed.')
    const assembly = await ctx.systemPrompt.assemble()
    if (!assembly.sections.some(item => item.name === 'wetflow:research-policy') || !assembly.contexts.some(item => item.name === 'wetflow:active-run')) throw new Error('WetFlow global context is unavailable')
    console.log('[dsh-wetflow] Harness-wide policy and active context are registered.')
    if (process.env.DSH_WETFLOW_SELFTEST === 'isolated') {
      const call = (name, args) => ctx.tools.execute({ callId: `check-${name}-${Date.now()}`, name, arguments: args, signal: new AbortController().signal })
      let disposeProbe
      if (!ctx.tools.get('write')) {
        disposeProbe = ctx.tools.register(defineTool({
          name:'write', description:'Isolated guard probe',
          parameters:{file_path:{type:'string',required:true},content:{type:'string',required:true}},
          output:{schema:{type:'string'},render:(_args,value)=>[{type:'text',text:value}]},
          async execute(){return 'unexpected write'},
        }))
      }
      const guarded = await call('write', {file_path:join(data,'protected-test.txt'),content:'should not be written'})
      disposeProbe?.()
      if (!guarded.isError || !JSON.stringify(guarded.error).includes('受控服务')) throw new Error('Protected file tool guard failed')
      console.log('[dsh-wetflow] DSH registry blocked direct access to the protected data directory.')
      const runId = agent.snapshot().workflow.id
      const mdEnv=await call('wetflow_md_platforms', {})
      if(mdEnv.isError || typeof JSON.parse(mdEnv.value).available!=='boolean') throw new Error('DSH MD platform check failed')
      const md = await call('wetflow_md_compare', {runId, baselineFeed:1, comparisonFeed:1.25})
      if (md.isError || JSON.parse(md.value).baseline.compatibleFractionPercent!==25.2 || JSON.parse(md.value).comparison.compatibleFractionPercent!==5.2) throw new Error('DSH MD tool check failed')
      const sources = await call('wetflow_research_sources', {runId})
      if (sources.isError || !Array.isArray(JSON.parse(sources.value).items)) throw new Error('DSH research tool check failed')
      const schemaCheck = await call('wetflow_research_schema', {runId})
      const queryCheck = await call('wetflow_research_query', {runId,sql:'SELECT id FROM sources LIMIT 1'})
      if (schemaCheck.isError || queryCheck.isError) throw new Error('DSH research query check failed')
      console.log('[dsh-wetflow] DSH research and MD tool checks passed.')
      const contextBefore = (await ctx.systemPrompt.assemble()).contexts.find(item => item.name === 'wetflow:active-run')?.text
      if (!contextBefore?.includes(runId)) throw new Error('Current workflow is missing from the global context')
      const stages = [{key:'DESIGN',label:'设计',description:'整理资料'}, {key:'TEST',label:'检测',description:'记录观测'}]
      let approval = agent.requestExternalApproval('workflow_set_plan',{stages})
      await agent.decide(approval.id,'reject')
      if(agent.snapshot().workflow.currentStage!=='DRAFT')throw new Error('Rejected plan changed state')
      approval=agent.requestExternalApproval('workflow_set_plan',{stages})
      await agent.decide(approval.id,'approve')
      if(agent.snapshot().workflow.currentStage!=='DESIGN')throw new Error('Approved plan not applied')
      approval=agent.requestExternalApproval('workflow_advance',{stage:'TEST'})
      if(agent.snapshot().workflow.currentStage!=='DESIGN')throw new Error('Advance proposal check failed')
      await agent.decide(approval.id,'approve')
      if(agent.snapshot().workflow.currentStage!=='TEST')throw new Error('Approved advance not applied')
      agent.store.addEvidenceSource('test.txt', 'unique isolation test data')
      agent.newWorkflowRun('隔离测试运行')
      const newRunId = agent.snapshot().workflow.id
      const contextAfter = (await ctx.systemPrompt.assemble()).contexts.find(item => item.name === 'wetflow:active-run')?.text
      if (!contextAfter?.includes(newRunId) || contextAfter.includes(runId)) throw new Error('Global context did not follow the selected run')
      const stale = await call('wetflow_search_evidence', {runId, query:'unique isolation test data'})
      if (!stale.isError || agent.store.searchEvidence('unique isolation test data', 4).length) throw new Error('Run isolation check failed')
      console.log('[dsh-wetflow] DSH pipeline plan, reject, approve, stage order and isolation checks passed.')
    }
  }

}
