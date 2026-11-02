import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
const root=resolve(import.meta.dirname,'..')
const tests=['network-proxy','web-bridge','workspace-files','mode-lifecycle','trusted-approval','process-gate','md-run','md-amber','md-agent','md-preparation']
for(const test of tests){
  console.log(`\nTesting ${test}`)
  const result=spawnSync(process.execPath,[`tests/${test}.mjs`],{cwd:root,stdio:'inherit',env:process.env})
  if(result.error)throw result.error
  if(result.status!==0)process.exit(result.status||1)
}
