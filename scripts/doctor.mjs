import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
let failed=false
function check(label, ok, detail){console.log(`${ok?'OK':'MISSING'} ${label}${detail?': '+detail:''}`);if(!ok)failed=true}
check('Linux / WSL',process.platform==='linux',process.platform)
check('Node.js',Number(process.versions.node.split('.')[0])>=22,process.versions.node)
const local=join(homedir(),'.local/libexec/wetflow/bwrap')
const bwrap=process.env.DSH_WETFLOW_BWRAP||(existsSync(local)?local:'/usr/bin/bwrap')
const b=spawnSync(bwrap,['--unshare-user','--unshare-pid','--unshare-net','--ro-bind','/','/','--proc','/proc','--dev','/dev','--','true'],{encoding:'utf8',timeout:5000})
check('Bubblewrap namespaces',!b.error&&b.status===0,b.error?.message||b.stderr?.trim()||bwrap)
const python=process.env.DSH_WETFLOW_MD_PYTHON||'python3'
const py=spawnSync(python,['-E','-P','-c',"import json,sys,openmm; print(json.dumps({'python':sys.version.split()[0],'openmm':openmm.__version__,'platforms':[openmm.Platform.getPlatform(i).getName() for i in range(openmm.Platform.getNumPlatforms())]}))"],{encoding:'utf8',timeout:15000})
check('MD Python / OpenMM',!py.error&&py.status===0,py.error?.message||py.stdout?.trim()||py.stderr?.trim())
check('Built WetFlow core',existsSync(join(import.meta.dirname,'../wetflow/dist/node/server.js')),'run npm run build if missing')
console.log('Supported DSH release: 0.2.1-rc.5. Run dsh --version to check the host.')
process.exitCode=failed?1:0
