import { spawn } from 'child_process'
import { join } from 'path'

export type MacSamplerPathOptions = {
  isPackaged: boolean
  appPath: string
  resourcesPath: string
}

export function resolveMacSamplerPath({
  isPackaged,
  appPath,
  resourcesPath
}: MacSamplerPathOptions): string {
  if (isPackaged) {
    return join(resourcesPath, 'macos', 'snidge-sampler')
  }

  return join(appPath, 'resources', 'macos', 'snidge-sampler')
}

export function parseSamplerOutput(stdout: string): string | null {
  const value = stdout.trim()
  if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
    return null
  }

  return value.toUpperCase()
}

export function runMacSampler(helperPath: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const child = spawn(helperPath, [], {
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')

    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })

    child.once('error', reject)

    child.once('close', (code, signal) => {
      if (code === 2) {
        resolve(null)
        return
      }

      if (code === 0) {
        const hex = parseSamplerOutput(stdout)
        if (hex) {
          resolve(hex)
          return
        }
      }

      reject(
        new Error(
          `macOS sampler failed with code=${code ?? 'null'} signal=${signal ?? 'null'} stderr=${stderr.trim()}`
        )
      )
    })
  })
}
