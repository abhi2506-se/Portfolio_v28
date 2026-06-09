/**
 * POST /api/meetings/generate-link
 *
 * Generates a video call link for a booking (called from admin UI).
 * Uses shared generator functions from lib/meeting-link-generators.ts
 *
 * Strategy (in priority order):
 *   1. User's preferred platform (if API credentials configured)
 *   2. Google Meet → Zoom → Teams (fallback chain)
 *   3. Jitsi Meet (always available, zero credentials)
 */
import { NextRequest, NextResponse } from 'next/server'
import { dbGetBooking } from '@/lib/meeting-store'
import { generateMeetingLink } from '@/lib/meeting-link-generators'

export const dynamic = 'force-dynamic'

async function requireAdmin(req: NextRequest): Promise<boolean> {
  try {
    const res = await fetch(`${req.nextUrl.origin}/api/admin/session-check`, {
      headers: { cookie: req.headers.get('cookie') || '' },
    })
    return res.ok
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { bookingId } = await req.json()

    if (!bookingId) {
      return NextResponse.json({ error: 'bookingId is required' }, { status: 400 })
    }

    const booking = await dbGetBooking(bookingId)
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const result = await generateMeetingLink({
      name: booking.name,
      email: booking.email,
      proposed_date: booking.proposed_date,
      timezone: booking.timezone,
      type: booking.type,
      platform: booking.platform,
    })

    return NextResponse.json({
      link: result.link,
      platform: result.platform,
      auto: true,
      usedApi: result.usedApi,
      message: result.message,
    })
  } catch (e) {
    console.error('[generate-link POST]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
