import { NextRequest, NextResponse } from 'next/server'
import { GitService } from '../../../../execution/services/git-service'

const gitService = new GitService()

// GET: List all remotes
export async function GET() {
  try {
    const remotes = await gitService.listRemotes()
    return NextResponse.json({ remotes })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST: Add or update remote
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name = 'origin', url } = body

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    await gitService.addRemote(name, url)
    const remoteUrl = await gitService.getRemoteUrl(name)

    return NextResponse.json({
      success: true,
      message: `Remote '${name}' added/updated`,
      remote: { name, url: remoteUrl }
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
