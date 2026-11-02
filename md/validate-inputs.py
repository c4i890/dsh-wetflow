"""Read-only input checks, executed inside the same sandbox as ordinary tools."""
import json
import math
import sys
from pathlib import Path

import openmm as mm
from openmm import app, unit

try:
    pdb = app.PDBFile(sys.argv[1])
    count = pdb.topology.getNumAtoms()
    if count == 0 or not all(math.isfinite(v) for p in pdb.positions.value_in_unit(unit.nanometer) for v in p):
        raise ValueError('PDB 必须包含原子和有限坐标。')
    checks = ['PDB 可读取', '原子非空且坐标有限']
    if sys.argv[2] == 'system':
        system = mm.XmlSerializer.deserialize(Path(sys.argv[3]).read_text(encoding='utf-8'))
        if not isinstance(system, mm.System):
            raise ValueError('XML 不是 OpenMM System。')
        if system.getNumParticles() != count:
            raise ValueError('PDB 原子数与 System 粒子数不一致。')
        if system.usesPeriodicBoundaryConditions() and pdb.topology.getPeriodicBoxVectors() is None:
            raise ValueError('System 使用周期边界，但 PDB 没有周期盒信息。')
        checks += ['System 可读取', '原子数与粒子数一致', '周期边界输入检查']
    print(json.dumps({'status': 'passed', 'atomCount': count, 'openmmVersion': mm.__version__,
                      'checks': checks, 'scope': '文件与基本结构一致性；不验证力场选择、化学合理性或模拟收敛。'}, ensure_ascii=False))
except Exception as exc:
    print(f'{type(exc).__name__}: {exc}', file=sys.stderr)
    sys.exit(1)
