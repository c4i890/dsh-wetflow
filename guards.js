import { existsSync, realpathSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { homedir } from 'node:os'

function canonicalForCheck(path) {
  let probe = resolve(path), suffix = []
  while (!existsSync(probe)) {
    const parent = dirname(probe)
    if (parent === probe) break
    suffix.unshift(probe.slice(parent.length + (parent === '/' ? 0 : 1)))
    probe = parent
  }
  try { probe = realpathSync(probe) } catch { /* preserve the resolved path if lookup fails */ }
  return resolve(probe, ...suffix)
}
function contains(root, candidate) {
  const rel = relative(root, candidate)
  return rel === '' || (!rel.startsWith('..' + '/') && rel !== '..' && !isAbsolute(rel))
}

/** Guard DSH file tools from opening the managed database and attachment directory directly. */
export function protectedFileToolGuard(dataDirectory, execution) {
  const names = new Set(['read', 'write', 'edit', 'str_replace_editor', 'glob', 'grep'])
  if (!names.has(execution.name)) return undefined
  const args = execution.arguments
  if (!args || typeof args !== 'object' || Array.isArray(args)) return undefined
  const raw = args.file_path ?? args.path
  if (typeof raw !== 'string' || !raw.trim()) return undefined
  const cwd = execution.agent?.session?.header?.cwd || process.cwd()
  const expanded = raw === '~' ? homedir() : raw.startsWith('~/') ? resolve(homedir(), raw.slice(2)) : raw
  const target = canonicalForCheck(isAbsolute(expanded) ? expanded : resolve(cwd, expanded))
  if (contains(canonicalForCheck(dataDirectory), target)) {
    return 'WetFlow 项目数据由受控服务管理。请使用工作台或 wetflow 工具访问，不要直接操作数据库和附件目录。'
  }
  return undefined
}
