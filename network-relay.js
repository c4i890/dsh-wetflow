// Runs INSIDE each command's network namespace. Only the mounted proxy socket reaches the host.
import net from 'node:net'
import {spawn} from 'node:child_process'
const connections=new Set()
const server=net.createServer(client=>{
  const upstream=net.connect('/run/wetflow-egress.sock')
  for(const s of [client,upstream]){connections.add(s);s.once('close',()=>connections.delete(s))}
  client.on('error',()=>upstream.destroy());upstream.on('error',()=>client.destroy())
  client.on('close',()=>upstream.destroy());upstream.on('close',()=>client.end())
  client.pipe(upstream);upstream.pipe(client)
})
server.on('error',error=>{console.error('WetFlow 公网代理启动失败：'+error.message);process.exit(125)})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const proxy='http://127.0.0.1:'+server.address().port
const env={...process.env,http_proxy:proxy,https_proxy:proxy,HTTP_PROXY:proxy,HTTPS_PROXY:proxy,ALL_PROXY:proxy,all_proxy:proxy,NO_PROXY:'',no_proxy:'',npm_config_proxy:proxy,npm_config_https_proxy:proxy,npm_config_cache:'/tmp/wetflow-npm-cache',PIP_CACHE_DIR:'/tmp/wetflow-pip-cache'}
const argv=process.argv.slice(2)
// DSH's PTC protocol uses inherited fd 7, not Node's conventional fd 3.
const stdio=['inherit','inherit','inherit']
if(process.env.WETFLOW_CONTROL_FD==='1')stdio.push('ignore','ignore','ignore','ignore',7)
const child=spawn(argv[0],argv.slice(1),{stdio,env})
for(const signal of ['SIGTERM','SIGINT','SIGHUP'])process.on(signal,()=>child.kill(signal))
const finish=code=>{for(const s of connections)s.destroy();server.close();process.exitCode=code}
child.on('error',error=>{console.error(error.message);finish(125)})
child.on('exit',(code,signal)=>finish(code??(signal==='SIGINT'?130:143)))
