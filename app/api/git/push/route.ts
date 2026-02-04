import { NextRequest, NextResponse } from 'next/server'
import { GitService } from '../../../../execution/services/git-service'

const gitService = new GitService()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { remote = 'origin', branch = 'main', force = false, url } = body

    // If URL is provided, add/update remote first
    if (url) {
      await gitService.addRemote(remote, url)
    }

    // Check if remote exists
    const remoteUrl = await gitService.getRemoteUrl(remote)
    if (!remoteUrl) {
      return NextResponse.json(
        { error: `Remote '${remote}' does not exist. Provide a 'url' to create it.` },
        { status: 400 }
      )
    }

    // Push to remote
    await gitService.push(remote, branch, force)

    return NextResponse.json({
      success: true,
      message: `Successfully pushed to ${remote}/${branch}`,
      remote: remoteUrl
    })
  } catch (error) {
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Make sure you have push access to the remote repository'
      },
      { status: 500 }
    )
  }
}
