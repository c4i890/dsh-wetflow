import { constants, lstatSync, mkdirSync, realpathSync, renameSync } from 'node:fs'
import { mkdtemp, open, readlink, rm, writeFile } from 'node:fs/promises'
import { basename, join, relative, resolve } from 'node:path'
import { canonical, inside } from '../process-gate.js'

const manifestName = 'wetflow-preparation.json'

// Open the source before copying, then check the descriptor's actual target. A
// symlink/path swap must not turn this importer into a host-file read capability.
async function openSource(workspace, supplied, protectedRoots) {
  if (typeof supplied !== 'string' || !supplied.trim()) throw new Error('请提供工作区内的输入文件路径。')
  const path = resolve(workspace, supplied)
  const allowed = value => inside(workspace, value) && !relative(workspace, value).split('/').includes('.wetflow')
    && !protectedRoots.some(root => inside(root, value))
  if (!allowed(path) || realpathSync(path) !== path) throw new Error('只能导入当前普通工作区中的文件，不能使用符号链接或受控目录。')
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  try {
    const actual = await readlink(`/proc/self/fd/${handle.fd}`)
    const stat = await handle.stat({ bigint: true })
    if (actual !== path || !allowed(actual) || !stat.isFile() || stat.nlink !== 1n || stat.size === 0n)
      throw new Error('输入必须是工作区内非空、无硬链接的普通文件。')
    return { handle, path, stat }
  } catch (error) { await handle.close(); throw error }
}

function unchanged(a, b) {
  return a.size === b.size && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs && b.nlink === 1n
}

async function validate(runtime, python, workspace, directory, mode, names, signal) {
  const timeout = AbortSignal.timeout(60_000)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout
  const process = runtime.spawn({
    argv: [python, '-E', '-P', join(import.meta.dirname, 'validate-inputs.py'), join(directory, names.pdb),
      mode, names.system ? join(directory, names.system) : ''],
    cwd: workspace, env: {}, signal: combined, graceMs: 500,
    stdio: { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' },
  })
  let output = '', errors = ''
  process.stdout.setEncoding('utf8'); process.stderr.setEncoding('utf8')
  process.stdout.on('data', chunk => { output = (output + chunk).slice(-16384) })
  process.stderr.on('data', chunk => { errors = (errors + chunk).slice(-4096) })
  const result = await process.done
  combined.throwIfAborted()
  if (result.exitCode !== 0) throw new Error('MD 输入校验失败：' + (errors.trim() || output.trim() || '校验进程未正常完成。'))
  const validation = JSON.parse(output)
  if (validation.status !== 'passed') throw new Error('MD 输入未通过校验。')
  return validation
}

export async function importPreparedInputs({ registry, getRun, runtime, python = 'python3', protectedRoots = [], workspaceId, runId, params, signal }) {
  const guard = () => {
    signal?.throwIfAborted()
    if (getRun() !== runId) throw new Error('实验运行已切换，请重新确认后导入。')
  }
  guard()
  if (typeof runId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(runId)) throw new Error('实验运行标识无效。')
  const entry = registry.list().find(w => String(w.id) === workspaceId)
  if (!entry) throw new Error('请先选择有效的 DSH 工作区。')
  const workspace = realpathSync(entry.path), protectedPaths = protectedRoots.map(canonical)
  if (protectedPaths.some(root => inside(root, workspace) || inside(workspace, root)))
    throw new Error('请使用与程序目录和正式数据目录分开的工作区。')
  const mode = params.inputMode
  if (!['system', 'amber14'].includes(mode)) throw new Error('输入模式须为 system 或 amber14。')
  if (mode === 'amber14' && params.systemPath) throw new Error('提供 System XML 时请选择 system 模式。')
  if (params.notes !== undefined && typeof params.notes !== 'string') throw new Error('准备说明必须是文本。')
  const supplied = { pdb: params.pdbPath, ...(mode === 'system' ? { system: params.systemPath } : {}), script: params.preparationScriptPath }
  const sources = {}, names = {}; let temporary
  try {
    for (const [role, path] of Object.entries(supplied)) {
      sources[role] = await openSource(workspace, path, protectedPaths)
      const name = basename(sources[role].path)
      if (name === manifestName || Object.values(names).includes(name)) throw new Error('输入文件名冲突，请为结构、参数和准备脚本使用不同名称。')
      if (role === 'pdb' && !/\.pdb$/i.test(name) || role === 'system' && !/\.xml$/i.test(name))
        throw new Error('结构文件须为 .pdb，System 文件须为 .xml。')
      names[role] = name
    }
    // Create only the managed files subtree, rejecting redirected ancestors.
    let root = workspace
    for (const part of ['.wetflow', 'files', runId]) {
      root = join(root, part)
      try { mkdirSync(root, { mode: 0o700 }) } catch (error) { if (error.code !== 'EEXIST') throw error }
      if (!lstatSync(root).isDirectory() || realpathSync(root) !== root) throw new Error('工作区资料目录不能被重定向。')
    }
    temporary = await mkdtemp(join(root, '.upload-'))
    for (const [role, source] of Object.entries(sources)) {
      const target = await open(join(temporary, names[role]), 'wx', 0o600)
      try {
        const buffer = Buffer.alloc(256 * 1024)
        let position = 0
        while (BigInt(position) < source.stat.size) {
          guard()
          const length = Number(source.stat.size - BigInt(position) < BigInt(buffer.length) ? source.stat.size - BigInt(position) : BigInt(buffer.length))
          const { bytesRead } = await source.handle.read(buffer, 0, length, position)
          if (!bytesRead) throw new Error('准备文件在复制过程中被截断，请重新生成后导入。')
          let written = 0
          while (written < bytesRead) {
            const { bytesWritten } = await target.write(buffer, written, bytesRead - written, position + written)
            if (!bytesWritten) throw new Error('无法完整保存准备文件。')
            written += bytesWritten
          }
          position += bytesRead
        }
      } finally { await target.close() }
    }
    for (const source of Object.values(sources)) {
      if (!unchanged(source.stat, await source.handle.stat({ bigint: true }))) throw new Error('准备文件在导入过程中发生变化，请等待脚本结束后重试。')
    }
    guard()
    const validation = await validate(runtime, python, workspace, temporary, mode, names, signal)
    guard()
    const record = { kind: 'wetflow-md-preparation', version: 1, runId, workspaceId, inputMode: mode,
      importedAt: new Date().toISOString(), files: names,
      sources: Object.fromEntries(Object.entries(sources).map(([role, source]) => [role, relative(workspace, source.path)])),
      notes: params.notes || '', validation }
    await writeFile(join(temporary, manifestName), JSON.stringify(record, null, 2), { flag: 'wx', mode: 0o600 })
    guard()
    const directory = join(root, basename(temporary).replace('.upload-', 'prepared-'))
    renameSync(temporary, directory); temporary = undefined
    return { runId, inputMode: mode, pdbPath: join(directory, names.pdb),
      ...(names.system ? { systemPath: join(directory, names.system) } : {}),
      preparationScriptPath: join(directory, names.script), manifestPath: join(directory, manifestName), validation,
      next: '使用返回的已导入路径调用 wetflow_md_start；原工作区脚本仍可编辑，旧输入副本保持不变。' }
  } finally {
    await Promise.all(Object.values(sources).map(source => source.handle.close()))
    if (temporary) await rm(temporary, { recursive: true, force: true })
  }
}
