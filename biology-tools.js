import { readFileSync, realpathSync } from 'node:fs'
import { basename, join } from 'node:path'
import { FeedComparisonPlugin } from './wetflow/dist/node/plugins.js'
import { listWorkspaceFiles } from './workspace-files.js'

const examplePath=join(import.meta.dirname,'wetflow','examples','md-five-feed-summary.json')
export function compareMdReport({registry,workspaceId,runId,reportPath,baselineFeed,comparisonFeed}) {
  let file=examplePath,source='example'
  if(reportPath && reportPath!=='example') {
    const workspace=registry.list().find(w=>String(w.id)===workspaceId)
    if(!workspace)throw new Error('请先选择有效的 DSH 工作区。')
    const allowed=listWorkspaceFiles(workspace.path,runId)
    const selected=allowed.find(item=>item.path===reportPath)
    if(!selected)throw new Error('请选择当前实验运行中导入的报告文件。')
    const canonical=realpathSync(selected.path)
    if(canonical!==realpathSync(reportPath))throw new Error('报告路径无效。')
    file=canonical;source='workspace'
  }
  let document
  try{document=JSON.parse(readFileSync(file,'utf8'))}catch{throw new Error('无法读取 MD 汇总报告，请选择格式正确的 JSON 文件。')}
  return {source,sourceFile:basename(file),...FeedComparisonPlugin.compareFeeds(document,{baselineFeed,comparisonFeed})}
}
export function registerMdRoutes(app,registry,getRun){
  app.post('/api/wetflow-md/compare',async(request,reply)=>{
    try{
      const body=request.body??{}, run=getRun()
      if(body.runId!==run)return reply.code(409).send({error:'实验运行已切换，请重新选择报告。'})
      return compareMdReport({registry,workspaceId:body.workspaceId,runId:run,reportPath:body.reportPath,baselineFeed:body.baselineFeed,comparisonFeed:body.comparisonFeed})
    }catch(e){return reply.code(400).send({error:e.message||'无法比较报告。'})}
  })
}
