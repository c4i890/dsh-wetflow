import assert from 'node:assert/strict'
import {publicIPv4,resolvePublicTarget} from '../network-proxy.js'
for(const ip of ['0.0.0.0','10.1.2.3','100.64.1.1','127.0.0.1','169.254.169.254','172.16.0.1','192.168.0.1','198.18.0.1','224.0.0.1','255.255.255.255','::1','::ffff:127.0.0.1'])assert.equal(publicIPv4(ip),false,ip)
assert.equal(publicIPv4('1.1.1.1'),true)
for(const url of ['http://localhost/','http://localhost./','http://127.1/','http://2130706433/','http://0x7f000001/','http://[::1]/','http://[::ffff:127.0.0.1]/','http://1.1.1.1:4316/','file:///tmp/x'])await assert.rejects(resolvePublicTarget(new URL(url)))
await assert.rejects(resolvePublicTarget(new URL('https://example.test/'),async()=>[{address:'127.0.0.1'}]))
await assert.rejects(resolvePublicTarget(new URL('https://example.test/'),async()=>[{address:'1.1.1.1'},{address:'10.0.0.1'}]))
let lookups=0;const target=await resolvePublicTarget(new URL('https://example.test/'),async()=>{lookups++;return [{address:'1.1.1.1'}]});assert.equal(lookups,1);assert.deepEqual(target,{address:'1.1.1.1',port:443})
console.log('PASS target validation, private DNS answers, alternative address forms and pinned IP selection')
