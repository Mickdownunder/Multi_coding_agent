import { NextRequest, NextResponse } from 'next/server'
import { GitService } from '../../../../execution/services/git-service'

const gitService = new GitService()

interface GitHubRepo {
  name: string
  description?: string
  private?: boolean
  auto_init?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      repoName, 
      description = 'Control System - Autonomous Coding Agent',
      isPrivate = false,
      githubToken 
    } = body

    if (!repoName) {
      return NextResponse.json(
        { error: 'Repository name is required' },
        { status: 400 }
      )
    }

    if (!githubToken) {
      return NextResponse.json(
        { 
          error: 'GitHub Personal Access Token is required',
          details: 'Create one at: https://github.com/settings/tokens (needs "repo" scope)'
        },
        { status: 400 }
      )
    }

    // Create GitHub repository via API
    const repoData: GitHubRepo = {
      name: repoName,
      description,
      private: isPrivate,
      auto_init: false // We'll push existing code
    }

    const createResponse = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(repoData)
    })

    if (!createResponse.ok) {
      const errorData = await createResponse.json()
      return NextResponse.json(
        { 
          error: 'Failed to create GitHub repository',
          details: errorData.message || errorData.errors?.[0]?.message || 'Unknown error',
          githubError: errorData
        },
        { status: createResponse.status }
      )
    }

    const repo = await createResponse.json()
    const repoUrl = repo.clone_url // HTTPS URL
    const sshUrl = repo.ssh_url

    // Add remote to local Git repository
    await gitService.addRemote('origin', repoUrl)

    // Get current user info for better error messages
    let username = 'user'
    try {
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      })
      if (userResponse.ok) {
        const userData = await userResponse.json()
        username = userData.login
      }
    } catch {
      // Ignore user fetch errors
    }

    return NextResponse.json({
      success: true,
      message: `GitHub repository '${repoName}' created successfully!`,
      repository: {
        name: repo.name,
        fullName: repo.full_name,
        url: repo.html_url,
        cloneUrl: repoUrl,
        sshUrl: sshUrl,
        private: repo.private
      },
      remote: {
        name: 'origin',
        url: repoUrl
      },
      nextStep: 'Push your code using the Push button or run: git push -u origin main'
    })
  } catch (error) {
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Make sure your GitHub token has "repo" scope enabled'
      },
      { status: 500 }
    )
  }
}
