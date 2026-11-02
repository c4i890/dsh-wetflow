import assert from 'node:assert/strict'
import {mkdtemp,mkdir,copyFile,rm,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {compareMdReport} from '../biology-tools.js'
const cwd=await mkdtemp(join(tmpdir(),'wetflow-biology-'));const registry={list:()=>[{id:'w',path:cwd}]};const a={registry,workspaceId:'w',runId:'r1',baselineFeed:1,comparisonFeed:1.25}
try{
 const example=compareMdReport(a);assert.equal(example.baseline.compatibleFractionPercent,25.2);assert.equal(example.comparison.compatibleFractionPercent,5.2);assert.equal(example.source,'example')
 const dir=join(cwd,'.wetflow','files','r1','file-1');await mkdir(dir,{recursive:true});const file=join(dir,'report.json');await copyFile(new URL('../wetflow/examples/md-five-feed-summary.json',import.meta.url),file)
 const own=compareMdReport({...a,reportPath:file});assert.equal(own.source,'workspace');assert.equal(own.fractionChangePercentagePoints,-20)
 assert.throws(()=>compareMdReport({...a,runId:'r2',reportPath:file}),/当前实验运行/)
 const bad=join(dir,'invalid.json');await writeFile(bad,'not json');assert.throws(()=>compareMdReport({...a,reportPath:bad}),/格式正确/)
 console.log('Example, imported report, run isolation and invalid JSON: pass')
}finally{await rm(cwd,{recursive:true,force:true})}
