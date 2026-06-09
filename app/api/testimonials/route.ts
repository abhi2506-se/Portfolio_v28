import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS testimonials (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      job_title TEXT NOT NULL,
      company TEXT NOT NULL,
      text TEXT NOT NULL,
      photo_url TEXT NOT NULL DEFAULT '',
      rating INTEGER NOT NULL DEFAULT 5,
      linkedin_url TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      submitted_by_email TEXT NOT NULL DEFAULT '',
      created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
      approved_at BIGINT
    )
  `
}

// GET: fetch approved testimonials (public) or all (admin)
export async function GET(req: Request) {
  try {
    await ensureTables()
    const { searchParams } = new URL(req.url)
    const admin = searchParams.get('admin') === '1'
    const pending = searchParams.get('pending') === '1'

    let rows
    if (admin && pending) {
      rows = await sql`SELECT * FROM testimonials WHERE status = 'pending' ORDER BY created_at DESC`
    } else if (admin) {
      rows = await sql`SELECT * FROM testimonials ORDER BY created_at DESC`
    } else {
      rows = await sql`SELECT * FROM testimonials WHERE status = 'approved' ORDER BY approved_at DESC`
    }

    return NextResponse.json({ testimonials: rows })
  } catch (e) {
    console.error('[testimonials] GET error:', e)
    return NextResponse.json({ testimonials: [] })
  }
}

// POST: submit a new testimonial (user)
export async function POST(req: Request) {
  try {
    await ensureTables()
    const body = await req.json()
    const { name, job_title, company, text, photo_url, rating, linkedin_url, submitted_by_email } = body

    if (!name || !job_title || !company || !text) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 })
    }

    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    await sql`
      INSERT INTO testimonials (id, name, job_title, company, text, photo_url, rating, linkedin_url, submitted_by_email, status, created_at)
      VALUES (${id}, ${name}, ${job_title}, ${company}, ${text}, ${photo_url || ''}, ${rating || 5}, ${linkedin_url || ''}, ${submitted_by_email || ''}, 'pending', ${Date.now()})
    `

    // Try to notify admin via existing notification system
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/admin/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'testimonial',
          title: 'New Testimonial Request',
          body: `${name} from ${company} submitted a testimonial for approval.`,
          data: { testimonialId: id },
        }),
      }).catch(() => {}) // non-fatal
    } catch {}

    return NextResponse.json({ ok: true, id })
  } catch (e) {
    console.error('[testimonials] POST error:', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}

// PATCH: admin approve or reject
export async function PATCH(req: Request) {
  try {
    await ensureTables()
    const { id, action } = await req.json() // action: 'approve' | 'reject'

    if (action === 'approve') {
      await sql`UPDATE testimonials SET status = 'approved', approved_at = ${Date.now()} WHERE id = ${id}`
    } else if (action === 'reject') {
      await sql`UPDATE testimonials SET status = 'rejected' WHERE id = ${id}`
    } else if (action === 'delete') {
      await sql`DELETE FROM testimonials WHERE id = ${id}`
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[testimonials] PATCH error:', e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
