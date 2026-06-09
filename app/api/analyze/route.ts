// ─── POST /api/analyze ───────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import {
  parseGitHubUrl,
  buildGitHubAnalytics,
  fetchReadme,
  fetchFileTree,
  fetchFileContent,
} from '@/lib/github'
import {
  detectArchitecture,
  buildFileTree,
  parsePrismaSchema,
  buildAllDiagrams,
} from '@/lib/analyzer'
import { getCached, setCached } from '@/lib/cache'
import type { ProjectAnalysis } from '@/types/projects'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { repoUrl, projectSlug } = body

    if (!repoUrl) {
      return NextResponse.json({ error: 'repoUrl required' }, { status: 400 })
    }

    const cacheKey = `analysis:${repoUrl}`
    const cached = getCached(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    const parsed = parseGitHubUrl(repoUrl)
    if (!parsed) {
      return NextResponse.json({ error: 'Invalid GitHub URL' }, { status: 400 })
    }

    const { owner, repo } = parsed

    // Parallel fetch everything
    const [githubAnalytics, readme, rawTree] = await Promise.all([
      buildGitHubAnalytics(owner, repo),
      fetchReadme(owner, repo),
      fetchFileTree(owner, repo),
    ])

    const filePaths: string[] = rawTree
      .filter((f: { type: string }) => f.type === 'blob')
      .map((f: { path: string }) => f.path)
      .slice(0, 500)

    // Fetch key config files in parallel
    const configFiles = ['package.json', 'prisma/schema.prisma', 'schema.prisma']
    const configContents = await Promise.all(
      configFiles.map(f => fetchFileContent(owner, repo, f))
    )

    let packageJson: Record<string, unknown> = {}
    try {
      packageJson = JSON.parse(configContents[0]) || {}
    } catch { /* ignore */ }

    const prismaSchema = configContents[1] || configContents[2] || ''

    // Analyze
    const architecture = detectArchitecture(filePaths, packageJson, readme)
    const dbModels = prismaSchema ? parsePrismaSchema(prismaSchema) : []
    const diagrams = buildAllDiagrams(architecture, dbModels, filePaths, repo)
    const fileTree = buildFileTree(filePaths)

    const techStack: string[] = [
      architecture.frontend.framework,
      ...architecture.frontend.styling,
      architecture.backend.framework,
      architecture.database.name !== 'None' ? architecture.database.name : '',
      architecture.database.orm !== 'None' ? architecture.database.orm : '',
      ...architecture.patterns,
    ].filter(Boolean).filter(t => t !== 'Unknown' && t !== 'None')

    const analysis: ProjectAnalysis = {
      id: `${owner}/${repo}`,
      projectSlug: projectSlug || repo,
      repoUrl,
      readme,
      architecture,
      diagrams,
      githubAnalytics,
      techStack: [...new Set(techStack)],
      keyFeatures: extractKeyFeatures(readme),
      fileTree,
      analyzedAt: new Date().toISOString(),
      cached: false,
    }

    setCached(cacheKey, analysis)
    return NextResponse.json(analysis)
  } catch (err) {
    console.error('[analyze]', err)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}

function extractKeyFeatures(readme: string): string[] {
  const features: string[] = []
  const lines = readme.split('\n')

  let inFeatureSection = false
  for (const line of lines) {
    const lower = line.toLowerCase()
    if (lower.match(/^#+\s*(feature|what|key|highlight|capability)/)) {
      inFeatureSection = true
      continue
    }
    if (inFeatureSection && lower.match(/^#+\s/)) {
      inFeatureSection = false
    }
    if (inFeatureSection && line.match(/^[-*]\s+.+/)) {
      features.push(line.replace(/^[-*]\s+/, '').trim())
    }
  }

  if (features.length === 0) {
    // Extract from bullet points anywhere
    for (const line of lines) {
      if (line.match(/^[-*]\s+.{10,80}$/) && !line.toLowerCase().includes('install')) {
        features.push(line.replace(/^[-*]\s+/, '').trim())
      }
      if (features.length >= 6) break
    }
  }

  return features.slice(0, 8)
}
