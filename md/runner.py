"""Run a prepared OpenMM system, or prepare a standard biomolecular PDB with Amber14."""
import json
import math
import os
import sys
import traceback
from pathlib import Path


def emit(**info):
    print(json.dumps(info, ensure_ascii=False, allow_nan=False), flush=True)


def main():
    config = json.loads(sys.stdin.read())
    out = Path(config['outputDirectory'])
    import openmm as mm
    from openmm import app, unit

    pdb = app.PDBFile(str(out / 'input.pdb'))
    topology, positions = pdb.topology, pdb.positions
    box = topology.getPeriodicBoxVectors()
    mode = config['inputMode']
    emit(stage='preparing', engineVersion=mm.__version__)
    if mode == 'system':
        system = mm.XmlSerializer.deserialize((out / 'input-system.xml').read_text(encoding='utf-8'))
        if not isinstance(system, mm.System):
            raise ValueError('输入 XML 不是 OpenMM System。')
        if system.getNumParticles() != topology.getNumAtoms():
            raise ValueError('PDB 原子数与 System 粒子数不一致。')
        if system.usesPeriodicBoundaryConditions() and box is None:
            raise ValueError('该 System 使用周期边界，但 PDB 没有周期盒信息。')
    elif mode == 'amber14':
        ff = app.ForceField('amber14-all.xml', 'amber14/tip3p.xml')
        modeller = app.Modeller(topology, positions)
        modeller.addHydrogens(ff, pH=config['ph'])
        if config['solvate']:
            modeller.addSolvent(ff, model='tip3p', padding=config['paddingNm'] * unit.nanometer)
        topology, positions = modeller.topology, modeller.positions
        periodic = config['solvate']
        system = ff.createSystem(topology, nonbondedMethod=app.PME if periodic else app.NoCutoff,
                                 nonbondedCutoff=1*unit.nanometer, constraints=app.HBonds)
    else:
        raise ValueError('输入模式无效。')
    (out / 'system.xml').write_text(mm.XmlSerializer.serialize(system), encoding='utf-8')
    with (out / 'prepared.pdb').open('w', encoding='utf-8') as f:
        app.PDBFile.writeFile(topology, positions, f, keepIds=True)
    integrator = mm.LangevinMiddleIntegrator(config['temperatureK']*unit.kelvin,
        config['frictionPerPs']/unit.picosecond, config['timestepFs']*unit.femtoseconds)
    integrator.setRandomNumberSeed(config['seed'])
    platform = mm.Platform.getPlatformByName(config['platform'])
    sim = app.Simulation(topology, system, integrator, platform)
    sim.context.setPositions(positions)
    if topology.getPeriodicBoxVectors() is not None:
        sim.context.setPeriodicBoxVectors(*topology.getPeriodicBoxVectors())
    emit(stage='minimizing', platform=platform.getName(), particles=system.getNumParticles())
    if config['minimizeIterations']:
        sim.minimizeEnergy(maxIterations=config['minimizeIterations'])
    sim.context.setVelocitiesToTemperature(config['temperatureK']*unit.kelvin, config['seed'])
    interval = config['reportEvery']
    sim.reporters.append(app.DCDReporter(str(out/'trajectory.dcd'), interval))
    sim.reporters.append(app.StateDataReporter(str(out/'state.csv'), interval, step=True, time=True,
        potentialEnergy=True, kineticEnergy=True, temperature=True, separator=','))
    done=0
    while done<config['steps']:
        block=min(interval, config['steps']-done)
        sim.step(block); done+=block
        state=sim.context.getState(getEnergy=True)
        energy=state.getPotentialEnergy().value_in_unit(unit.kilojoule_per_mole)
        if not math.isfinite(energy):
            raise RuntimeError('模拟产生非有限势能，已停止。')
        emit(stage='running', stepsDone=done, stepsTotal=config['steps'], potentialEnergyKJMol=energy)
    sim.saveState(str(out/'final-state.xml'))
    sim.saveCheckpoint(str(out/'checkpoint.chk'))
    state=sim.context.getState(getPositions=True)
    with (out/'final.pdb').open('w',encoding='utf-8') as f:
        app.PDBFile.writeFile(topology,state.getPositions(),f,keepIds=True)
    report={'engine':'OpenMM','engineVersion':mm.__version__,'platform':platform.getName(),
        'inputMode':mode,'parameters':{k:v for k,v in config.items() if k != 'outputDirectory'},
        'particleCount':system.getNumParticles(),'completedSteps':done,
        'simulatedTimePs':done*config['timestepFs']/1000,'reactionEventsSimulated':False,
        'outputs':['prepared.pdb','system.xml','trajectory.dcd','state.csv','final.pdb','final-state.xml','checkpoint.chk']}
    (out/'result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    emit(stage='completed',result=report)


try:
    main()
except Exception as exc:
    emit(stage='failed', error=f'{type(exc).__name__}: {exc}')
    traceback.print_exc(file=sys.stderr)
    sys.exit(1)
