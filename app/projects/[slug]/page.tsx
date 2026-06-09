// ─── /projects/[slug] ─────────────────────────────────────────────────────────
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ProjectDetailClient } from '@/components/projects/project-detail-client'
import { defaultPortfolioData } from '@/lib/portfolio-data'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://abhisheksingh.dev'

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

// ── Normalise project fields so project-detail-client always gets the
//    shape it expects regardless of whether data came from DB or defaults ──────
function normalise(p: Record<string, unknown>) {
  const name  = (p.name  || p.title  || '') as string
  const tags  = ((p.tags  || p.tech   || []) as string[])
  const github = (p.github || p.repoUrl || '') as string
  const live   = (p.live  || p.liveUrl || '') as string
  return {
    ...p,
    name,
    title:          name,
    tags,
    tech:           tags,
    repoUrl:        github,
    liveUrl:        live,
    github,
    live,
    slug:           ((p.slug as string) || slugify(name)),
    longDescription: (p.longDescription || p.description || '') as string,
    description:    (p.description || '') as string,
    featured:       (p.featured || false) as boolean,
    status:         (p.status   || 'completed') as string,
    // Keep rich fields from portfolio-data
    features:       (p.features  || []) as string[],
    caseStudy:      p.caseStudy  || null,
  }
}

type NormalisedProject = ReturnType<typeof normalise>

async function getProjectData(slug: string): Promise<NormalisedProject | null> {
  // 1. Try live API
  try {
    const res = await fetch(`${BASE_URL}/api/portfolio-data`, {
      next: { revalidate: 60 },
    })
    if (res.ok) {
      const data = await res.json()
      const projects: Record<string, unknown>[] = data.projects || []
      const found = projects.find(p => {
        const name  = (p.name || p.title || '') as string
        const pSlug = (p.slug as string) || slugify(name)
        return pSlug === slug
      })
      if (found) return normalise(found)
    }
  } catch { /* fall through */ }

  // 2. Fallback to bundled defaultPortfolioData (always works, even offline)
  const found = (defaultPortfolioData.projects as unknown as Record<string, unknown>[]).find(p => {
    const name  = (p.name || p.title || '') as string
    return slugify(name) === slug
  })
  return found ? normalise(found) : null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const project  = await getProjectData(slug)
  if (!project) return { title: 'Project Not Found | Abhishek Singh' }

  const title       = `${project.name} | Abhishek Singh — Portfolio`
  const description = project.longDescription || project.description ||
    `Explore the ${project.name} project — architecture, tech stack, and details.`
  const url         = `${BASE_URL}/projects/${slug}`

  return {
    title,
    description,
    keywords: [...project.tags, 'project', 'portfolio', 'Abhishek Singh', 'software engineering'],
    authors:  [{ name: 'Abhishek Singh' }],
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'article' },
    twitter:   { card: 'summary_large_image', title, description },
  }
}

export async function generateStaticParams() {
  // Always generate params from defaultPortfolioData so build never fails
  const defaults = (defaultPortfolioData.projects as unknown as Record<string, unknown>[]).map(p => ({
    slug: slugify((p.name || p.title || '') as string),
  }))

  // Also try to fetch from API (best-effort)
  try {
    const res = await fetch(`${BASE_URL}/api/portfolio-data`)
    if (res.ok) {
      const data = await res.json()
      const fromApi = (data.projects || []).map((p: Record<string, unknown>) => ({
        slug: (p.slug as string) || slugify((p.name || p.title || '') as string),
      }))
      // Merge, dedupe
      const all = [...defaults, ...fromApi]
      const seen = new Set<string>()
      return all.filter(({ slug }) => {
        if (seen.has(slug)) return false
        seen.add(slug); return true
      })
    }
  } catch { /* use defaults */ }

  return defaults
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug }  = await params
  const project   = await getProjectData(slug)
  if (!project) notFound()

  return (
    <main className="min-h-screen bg-background">
      <ProjectDetailClient project={project} slug={slug} />
    </main>
  )
}
