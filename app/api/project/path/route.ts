import { NextResponse } from 'next/server'
import { resolve } from 'path'
import { Config } from '../../../../execution/config'

export async function GET() {
  try {
    const projectPath = process.cwd()
    let workspacePath: string = projectPath

    try {
      const config = Config.getInstance()
      await config.load()
      workspacePath = resolve(config.getWorkspaceConfig().projectPath)
    } catch {
      // Fallback: workspace = project root
    }

    return NextResponse.json({
      path: projectPath,
      relative: projectPath,
      workspacePath,
      isWorkspaceExternal: resolve(workspacePath) !== resolve(projectPath)
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
