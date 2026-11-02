import assert from 'node:assert/strict'
import {mkdtemp, mkdir, readFile, stat, rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {spawnSync} from 'node:child_process'
import {MdTaskService} from '../md/service.js'
const cwd=await mkdtemp(join(tmpdir(),'wf-md-run-'));const runId='run-test';const input=join(cwd,'.wetflow','files',runId,'file-test');await mkdir(input,{recursive:true});const pdb=join(input,'two-atoms.pdb'),xml=join(input,'two-atoms.xml')
const script=`import openmm as m\nfrom openmm import app,unit\nfrom openmm.vec3 import Vec3\nt=app.Topology(); c=t.addChain(); r=t.addResidue('MOL',c); a=t.addAtom('C1',app.element.carbon,r); b=t.addAtom('C2',app.element.carbon,r);t.addBond(a,b)\ns=m.System(); s.addParticle(12);s.addParticle(12); f=m.HarmonicBondForce();f.addBond(0,1,.15,1000);s.addForce(f)\nopen(${JSON.stringify(xml)},'w').write(m.XmlSerializer.serialize(s))\nwith open(${JSON.stringify(pdb)},'w') as o: app.PDBFile.writeFile(t,[Vec3(0,0,0),Vec3(.15,0,0)]*unit.nanometer,o)\n`
const gen=spawnSync('python3',['-c',script],{encoding:'utf8'});if(gen.status!==0)throw Error(gen.stderr)
const service=new MdTaskService({list:()=>[{id:'w',path:cwd}]},()=>runId);const wait=async(id)=>{for(let i=0;i<300;i++){const t=service.get('w',runId,id);if(['completed','failed','cancelled','interrupted'].includes(t.status))return t;await new Promise(r=>setTimeout(r,100))}throw Error('Timeout')}
try{
 const platforms=await service.platforms();assert.ok(platforms.available&&platforms.platforms.includes('CPU'))
 const job=service.start('w',runId,{pdbPath:pdb,systemPath:xml,inputMode:'system',platform:'CPU',steps:100,reportEvery:20,temperatureK:300,timestepFs:1,minimizeIterations:10});const done=await wait(job.id);assert.equal(done.status,'completed',done.error);assert.equal(done.result.completedSteps,100);for(const name of ['trajectory.dcd','state.csv','final.pdb','system.xml','result.json','checkpoint.chk'])assert.ok((await stat(join(done.outputDirectory,name))).size>0,`${name} empty`);assert.equal(JSON.parse(await readFile(join(done.outputDirectory,'result.json'))).reactionEventsSimulated,false);console.log('Actual CPU OpenMM run and output artifacts: pass')
 const long=service.start('w',runId,{pdbPath:pdb,systemPath:xml,inputMode:'system',platform:'CPU',steps:10000000,reportEvery:5000,temperatureK:300,timestepFs:1,minimizeIterations:10});service.cancel('w',runId,long.id);assert.equal((await wait(long.id)).status,'cancelled');console.log('Cancellation and persisted state: pass')
 assert.throws(()=>service.get('w','other-run',job.id),/运行已切换/);console.log('Run isolation: pass')
}finally{service.close();await rm(cwd,{recursive:true,force:true})}
