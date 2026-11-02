import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root=resolve(import.meta.dirname,'..')
const manifest=JSON.parse(readFileSync(join(root,'package.json'),'utf8'))
function run(command,args,options={}){
  const result=spawnSync(command,args,{cwd:root,stdio:'inherit',...options})
  if(result.error)throw result.error
  if(result.status!==0)throw new Error(`${command} failed (${result.status})`)
}
run(process.execPath,['scripts/build.mjs','--if-needed'])
const files=new Set(['package.json','.gitignore'])
function add(relative){
  const path=join(root,relative),stat=lstatSync(path)
  if(stat.isSymbolicLink())throw new Error('Release cannot contain symlinks: '+relative)
  if(stat.isDirectory()){
    for(const name of readdirSync(path)){
      if(['node_modules','__pycache__','.git','.wetflow'].includes(name))continue
      add(relative+'/'+name)
    }
  }else if(stat.isFile()){
    if(/(?:^|\/)(?:\.env(?:\..*)?|.*\.(?:db|sqlite|log|pyc|pem|key))$/.test(relative)&&!relative.endsWith('.env.example'))throw new Error('Unexpected runtime or private file: '+relative)
    files.add(relative)
  }
}
for(const pattern of manifest.files){
  if(pattern==='*.js'){for(const name of readdirSync(root).filter(n=>n.endsWith('.js')))add(name)}
  else if(existsSync(join(root,pattern)))add(pattern)
  else throw new Error('Missing release file: '+pattern)
}
const output=join(root,'release');mkdirSync(output,{recursive:true})
const temporary=mkdtempSync(join(tmpdir(),'wetflow-release-list-'))
try{
  const paths=[...files].sort()
  const list=join(temporary,'files');writeFileSync(list,paths.join('\0')+'\0')
  const archive=join(output,`${manifest.name}-${manifest.version}.tgz`)
  run('tar',['-czf',archive,'--transform=s,^,package/,','--null','-T',list])
  const sourcePaths=paths.filter(p=>!p.startsWith('wetflow/dist/'))
  const source=join(output,`${manifest.name}-${manifest.version}-source.zip`)
  run('python3',['-c',
    'import json,sys,zipfile; from pathlib import Path; root=Path(sys.argv[1]); items=json.load(sys.stdin); z=zipfile.ZipFile(sys.argv[2],"w",zipfile.ZIP_DEFLATED); [z.write(root/p,"dsh-wetflow/"+p) for p in items]; z.close()',root,source],
    {input:JSON.stringify(sourcePaths),stdio:['pipe','inherit','inherit']})
  console.log(`Installable package: ${archive}\nSource archive: ${source}\nIncluded files: ${paths.length}`)
}finally{rmSync(temporary,{recursive:true,force:true})}
