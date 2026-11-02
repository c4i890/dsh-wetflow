import http from 'node:http'
import net from 'node:net'
import {lookup} from 'node:dns/promises'
import {mkdtempSync,rmSync,chmodSync} from 'node:fs'
import {tmpdir,networkInterfaces} from 'node:os'
import {join} from 'node:path'

const privateAddresses=new net.BlockList()
for(const [ip,bits] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]])privateAddresses.addSubnet(ip,bits)
export function publicIPv4(address){return net.isIP(address)===4&&!privateAddresses.check(address)}
async function lookupForEgress(host,options){
  const answers=await lookup(host,options)
  // Fake-IP TUN resolvers use 198.18/15. Obtain real public records instead of allowing that range.
  if(!answers.length||!answers.every(x=>/^198\.(18|19)\./.test(x.address)))return answers
  const url=new URL('https://dns.google/resolve')
  url.searchParams.set('name',host);url.searchParams.set('type','A');url.searchParams.set('edns_client_subnet','0.0.0.0/0')
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(10000)})
  if(!response.ok)throw new Error('公网 DNS 解析失败。')
  const body=await response.json()
  if(body.Status!==0)throw new Error('公网 DNS 无有效记录。')
  return (body.Answer||[]).filter(x=>x.type===1).map(x=>({address:x.data,family:4}))
}

export async function resolvePublicTarget(url,resolve=lookupForEgress){
  if(url.protocol!=='http:'&&url.protocol!=='https:'||url.username||url.password)throw new Error('只允许 HTTP(S) 公网目标。')
  const port=Number(url.port||(url.protocol==='https:'?443:80))
  if(port!==80&&port!==443)throw new Error('只允许公网 80/443 端口。')
  const host=url.hostname.replace(/\.$/,'').toLowerCase()
  if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local'))throw new Error('本地地址不允许通过代理访问。')
  const own=new Set(Object.values(networkInterfaces()).flat().filter(Boolean).map(x=>x.address))
  const addresses=net.isIP(host)?[{address:host}]:await resolve(host,{family:4,all:true})
  if(!addresses.length||addresses.some(x=>!publicIPv4(x.address)||own.has(x.address)))throw new Error('私有地址或本机地址不允许通过代理访问。')
  // The connection uses this checked address directly, never a second DNS lookup.
  return {address:addresses[0].address,port}
}

export async function startNetworkProxy(){
  const directory=mkdtempSync(join(tmpdir(),'wetflow-egress-'))
  const socketPath=join(directory,'proxy.sock'),sockets=new Set()
  const track=s=>{sockets.add(s);s.once('close',()=>sockets.delete(s));return s}
  const deny=(response,error)=>{if(!response.headersSent)response.writeHead(403,{'Content-Type':'text/plain; charset=utf-8'});response.end('WetFlow 公网代理拒绝目标：'+error.message)}
  const server=http.createServer(async(req,res)=>{
    let upstream
    try{
      const url=new URL(req.url)
      if(url.protocol!=='http:')throw new Error('HTTPS 请使用 CONNECT。')
      const target=await resolvePublicTarget(url)
      const headers={...req.headers,host:url.host}
      for(const name of ['connection','proxy-connection','proxy-authorization','upgrade',...(req.headers.connection||'').split(',').map(s=>s.trim().toLowerCase())])delete headers[name]
      upstream=http.request({hostname:target.address,port:target.port,method:req.method,path:url.pathname+url.search,headers,agent:false},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res)})
      upstream.setTimeout(120000,()=>upstream.destroy(new Error('网络超时')))
      upstream.on('socket',track)
      upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end('公网连接失败。')})
      req.on('aborted',()=>upstream.destroy());res.on('close',()=>upstream.destroy());req.pipe(upstream)
    }catch(error){upstream?.destroy();deny(res,error)}
  })
  server.on('connection',track)
  server.on('connect',async(req,client,head)=>{
    let upstream
    try{
      const url=new URL('http://'+req.url)
      if(url.pathname!=='/'||url.search||url.hash)throw new Error('CONNECT 目标无效。')
      const target=await resolvePublicTarget(url)
      if(client.destroyed)return
      upstream=track(net.connect({host:target.address,port:target.port}))
      upstream.setTimeout(120000,()=>upstream.destroy())
      upstream.once('connect',()=>{client.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head.length)upstream.write(head);client.pipe(upstream);upstream.pipe(client)})
      upstream.on('error',()=>client.destroy());client.on('error',()=>upstream.destroy());client.on('close',()=>upstream.destroy());upstream.on('close',()=>client.end())
    }catch{client.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');upstream?.destroy()}
  })
  server.on('upgrade',(_req,socket)=>socket.destroy())
  server.on('clientError',(_error,socket)=>socket.destroy())
  try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(socketPath,resolve)});chmodSync(socketPath,0o600)}
  catch(error){rmSync(directory,{recursive:true,force:true});throw error}
  return {socketPath,close:async()=>{for(const s of sockets)s.destroy();await new Promise(resolve=>server.close(resolve));rmSync(directory,{recursive:true,force:true})}}
}
