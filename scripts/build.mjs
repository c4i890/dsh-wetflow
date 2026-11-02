import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
const root = resolve(import.meta.dirname, '..')
if (process.argv.includes('--if-needed') && ['server.js', 'plugins.js', 'worker.py'].every(name => existsSync(resolve(root, 'wetflow/dist/node', name)))) process.exit(0)
function run(args) {
  const result = spawnSync('npm', args, { cwd: root, stdio: 'inherit', env: { ...process.env, npm_config_audit: 'false', npm_config_fund: 'false' } })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status || 1)
}
// The embedded core has its own committed lockfile. Never use a sibling checkout
// or the developer's DSH node_modules to build it.
run(['ci', '--prefix', 'wetflow', '--include=dev', '--ignore-scripts'])
run(['run', 'bundle:node', '--prefix', 'wetflow'])
