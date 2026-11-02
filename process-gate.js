import { existsSync, mkdirSync, realpathSync, lstatSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, relative, resolve, isAbsolute } from 'node:path'
import { homedir } from 'node:os'
import { startNetworkProxy } from './network-proxy.js'

export function canonical(path) {
  let p=resolve(path), tail=[]
  while(!existsSync(p)){const d=dirname(p);if(d===p)break;tail.unshift(p.slice(d.length+(d==='/'?0:1)));p=d}
  return resolve(realpathSync(p),...tail)
}
export function inside(root,path){const r=relative(root,path);return r===''||r!=='..'&&!r.startsWith('../')&&!isAbsolute(r)}
const denied='WetFlow 受控服务门禁：实验数据库和运行资料不能通过普通工具修改。'

// Existing hard-link aliases would survive path-based mounts. Refuse them before activation.
function checkProtectedTree(root){
  if(!existsSync(root))return
  const info=lstatSync(root)
  if(info.isSymbolicLink())throw new Error('受控目录内存在符号链接，无法启用隔离：'+root)
  if(info.isFile()&&info.nlink>1)throw new Error('受控文件存在硬链接，无法启用隔离：'+root)
  if(info.isDirectory())for(const entry of readdirSync(root))checkProtectedTree(join(root,entry))
}

/** Wrap the actual subprocess and filesystem capabilities, below individual tools. */
export async function installProcessGate(ctx,dataDirectory){
  const data=canonical(dataDirectory),runtime=ctx.get('subprocess'),fs=ctx.get('fs')
  const state={status:'incomplete',message:'命令执行服务未接入；不能声明完整门禁。',backend:'none'}
  if(!runtime)return {state}
  const localRunner=join(homedir(),'.local/libexec/wetflow/bwrap')
  const runner=process.env.DSH_WETFLOW_BWRAP||(existsSync(localRunner)?localRunner:'/usr/bin/bwrap')
  const base=['--unshare-user','--unshare-pid','--unshare-net','--unshare-ipc','--unshare-uts','--die-with-parent','--new-session','--cap-drop','ALL','--ro-bind','/','/','--proc','/proc','--dev','/dev','--tmpfs','/tmp','--tmpfs','/run','--unsetenv','WSL_INTEROP','--unsetenv','DBUS_SESSION_BUS_ADDRESS','--unsetenv','SSH_AUTH_SOCK']
  let failure
  const probe=spawnSync(runner,[...base,'--','true'],{encoding:'utf8',timeout:5000})
  if(probe.error||probe.status!==0)failure='系统沙盒不可用，命令未执行：'+String(probe.error?.message||probe.stderr).slice(0,240)
  try{checkProtectedTree(data)}catch(error){failure=error.message}
  let egress
  if(!failure){try{egress=await startNetworkProxy()}catch(error){failure='公网代理不可用，命令未执行：'+error.message}}
  const originalSpawn=runtime.spawn,originalTerminal=runtime.spawnTerminal
  const running=new Set(),restores=[]
  const roots=()=>ctx.workspaceRegistry.list().map(w=>canonical(w.path))
  const runtimeHome=canonical(process.env.DSH_HOME||join(homedir(),'.dsh'))
  const pluginCode=canonical(dirname(new URL(import.meta.url).pathname))
  const protectedRoots=()=>[data,runtimeHome,pluginCode,canonical(runner),...roots().map(r=>join(r,'.wetflow'))]
  function prepare(spec){
    if(failure)throw new Error(failure)
    const cwd=canonical(spec.cwd),workspaces=roots()
    const workspace=workspaces.filter(r=>inside(r,cwd)).sort((a,b)=>b.length-a.length)[0]
    const argv=[runner,...base]
    // /tmp is private in the sandbox. A plugin installed under /tmp must still
    // expose its own read-only relay and validation scripts to subprocesses.
    if(inside('/tmp',pluginCode))argv.push('--ro-bind',pluginCode,pluginCode)
    if(workspace){
      // Never make the runtime/configuration or the authoritative data writable.
      const dshHome=canonical(process.env.DSH_HOME||join(homedir(),'.dsh'))
      const code=canonical(dirname(new URL(import.meta.url).pathname))
      if(inside(workspace,data)||inside(workspace,dshHome)||inside(workspace,code))throw new Error('工作区包含 WetFlow 数据或 DSH 程序目录，请选用独立的普通工作区。')
      argv.push('--bind',workspace,workspace)
    }
    for(const root of workspaces){
      const managed=join(root,'.wetflow')
      if(!existsSync(managed)){if(root!==workspace)continue;mkdirSync(managed,{recursive:true})}
      if(canonical(managed)!==managed)throw new Error('工作区受控目录不能是符号链接。')
      checkProtectedTree(managed)
      argv.push('--ro-bind',managed,managed)
    }
    // Mask databases, sockets and host process state, including when data lives in /tmp.
    argv.push('--tmpfs',data,'--remount-ro',data)
    if(existsSync('/mnt/wsl'))argv.push('--tmpfs','/mnt/wsl')
    argv.push('--ro-bind',egress.socketPath,'/run/wetflow-egress.sock','--chdir',cwd,'--',process.execPath,join(pluginCode,'network-relay.js'),...spec.argv)
    return {...spec,argv,env:{...spec.env,WSL_INTEROP:undefined,DBUS_SESSION_BUS_ADDRESS:undefined,SSH_AUTH_SOCK:undefined,WETFLOW_CONTROL_FD:spec.stdio?.control==='pipe'?'1':'0'}}
  }
  const track=handle=>{running.add(handle);handle.done.finally(()=>running.delete(handle)).catch(()=>{});return handle}
  runtime.spawn=function(spec){return track(originalSpawn.call(this,prepare(spec)))}
  runtime.spawnTerminal=async function(spec){return track(await originalTerminal.call(this,prepare(spec)))}
  restores.push(()=>{runtime.spawn=originalSpawn;runtime.spawnTerminal=originalTerminal})
  ctx.effect(()=>async()=>{await Promise.all([...running].map(async h=>{await h.terminate();await h.done.catch(()=>{})}));await egress?.close();for(const restore of restores.reverse())restore()},'Restore process and file capabilities')
  // Old persistent shells must not remain an unconfined back door after enabling the plugin.
  const previous=[...(runtime.live||[]),...(runtime.terminals||[])]
  await Promise.all(previous.map(async h=>{await h.terminate();await h.done.catch(()=>{})}))
  if(fs){
    for(const method of ['readText','streamText','readBytes','readByteRange','listDir','writeText','editText']){
      const original=fs[method];if(typeof original!=='function')continue
      fs[method]=function(target,...args){
        const raw=this.processPath(target),path=canonical(raw),write=method==='writeText'||method==='editText'
        if(inside(data,path)||['/proc','/sys','/run'].some(r=>inside(r,path)||inside(r,raw))||write&&protectedRoots().some(r=>inside(r,path)||inside(path,r)))throw new Error(denied)
        if(write&&existsSync(path)&&lstatSync(path).nlink>1)throw new Error('不能通过普通工具改写硬链接文件，请先另存为独立文件。')
        return original.call(this,target,...args)
      }
      restores.push(()=>{fs[method]=original})
    }
  }
  // DSH's Node PTC interpreter also uses subprocess.spawn and inherits this boundary.
  state.status=failure?'unavailable':fs?'active':'incomplete'
  state.backend='bubblewrap';state.network='public-http-proxy'
  state.message=failure||'系统沙盒已接入：普通工作区可读写，受控记录经服务处理；命令可通过代理访问公网，本机和私有地址仍被隔离。'
  if(!fs&&!failure)state.message+=' 文件服务尚未加载。'
  return {state}
}
