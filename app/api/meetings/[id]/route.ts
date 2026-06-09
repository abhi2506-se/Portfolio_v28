/**
 * PATCH /api/meetings/[id]   — admin approves or rejects
 * DELETE /api/meetings/[id]  — admin deletes
 *
 * v4: Fixed Next.js 15/16 async params (params is now a Promise).
 *     Uses shared generateMeetingLink() directly — no internal HTTP.
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  dbApproveBooking, dbRejectBooking, dbDeleteBooking,
  dbGetBooking, dbMarkNotified,
} from '@/lib/meeting-store'
import { dbGetSettings } from '@/lib/db'
import { generateMeetingLink } from '@/lib/meeting-link-generators'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

/* ── Helpers ─────────────────────────────────────────────────────────────── */
async function getResend() {
  try {
    const s = (await dbGetSettings()) as Record<string, string>
    const key = s.resend_api_key || process.env.RESEND_API_KEY || ''
    return key ? new Resend(key) : null
  } catch { return null }
}

async function getFromEmail() {
  try {
    const s = (await dbGetSettings()) as Record<string, string>
    return (
      s.resend_from_email ||
      process.env.RESEND_FROM_EMAIL ||
      'Abhishek Singh <noreply@resend.dev>'
    )
  } catch {
    return 'Abhishek Singh <noreply@resend.dev>'
  }
}

function platformLabel(platform: string): string {
  return (
    ({
      google_meet: 'Google Meet',
      zoom: 'Zoom',
      teams: 'Microsoft Teams',
      any: 'Video Call',
      jitsi: 'Jitsi Meet',
    } as Record<string, string>)[platform] ?? 'Video Call'
  )
}

function platformIcon(platform: string): string {
  return (
    ({
      google_meet: '🟢',
      zoom: '🔵',
      teams: '🟣',
      jitsi: '🎥',
      any: '📹',
    } as Record<string, string>)[platform] ?? '📹'
  )
}

function detectPlatformFromLink(link: string): string {
  if (link.includes('meet.google.com')) return 'google_meet'
  if (link.includes('zoom.us')) return 'zoom'
  if (link.includes('teams.microsoft')) return 'teams'
  if (link.includes('meet.jit.si')) return 'jitsi'
  return 'any'
}

/* ── Approval email ──────────────────────────────────────────────────────── */
async function sendApprovalEmail(
  resend: Resend,
  booking: Awaited<ReturnType<typeof dbGetBooking>>
) {
  if (!booking) return

  const typeLabel = booking.type === 'interview' ? 'Interview' : 'Meeting'
  const platform = detectPlatformFromLink(booking.meeting_link ?? '')
  const platLabel = platformLabel(platform)
  const platIcon = platformIcon(platform)

  const formattedDate = new Date(booking.proposed_date).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const joinButton =
    booking.meeting_link && booking.meeting_link !== 'PENDING_LINK'
      ? `<div style="text-align:center;margin-bottom:28px">
          <a href="${booking.meeting_link}"
            style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none">
            ${platIcon} Join ${platLabel}
          </a>
          <p style="margin:12px 0 0;color:#475569;font-size:11px">
            Or copy: <a href="${booking.meeting_link}" style="color:#60a5fa">${booking.meeting_link}</a>
          </p>
        </div>`
      : `<div style="background:#1e3a5f22;border:1px solid #1e40af44;border-radius:10px;padding:16px;margin-bottom:24px">
          <p style="margin:0;color:#93c5fd;font-size:13px">⏳ The meeting link will be sent to you shortly. Keep an eye on your inbox!</p>
        </div>`

  await resend.emails.send({
    from: await getFromEmail(),
    to: booking.email,
    subject: `✅ Your ${typeLabel} is Confirmed! — ${formattedDate}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif">
        <div style="max-width:580px;margin:32px auto;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155">
          <div style="background:linear-gradient(135deg,#1d4ed8,#0f172a);padding:32px 32px 24px">
            <div style="font-size:36px;margin-bottom:8px">✅</div>
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">Your ${typeLabel} is Confirmed!</h1>
            <p style="margin:6px 0 0;color:#93c5fd;font-size:14px">Here's everything you need to join</p>
          </div>
          <div style="padding:28px 32px">
            <p style="margin:0 0 20px;color:#cbd5e1;font-size:15px">
              Hi <strong style="color:#f1f5f9">${booking.name}</strong>,
            </p>
            <p style="margin:0 0 24px;color:#94a3b8;font-size:14px">
              Your ${typeLabel.toLowerCase()} request has been <strong style="color:#4ade80">approved</strong>.
            </p>
            <div style="background:#0f172a;border:1px solid #1e40af;border-radius:12px;padding:20px;margin-bottom:24px">
              <table style="width:100%;border-collapse:collapse">
                <tr>
                  <td style="padding:8px 0;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;width:120px">Type</td>
                  <td style="padding:8px 0;color:#e2e8f0;font-size:14px">${booking.type === 'interview' ? '💼' : '📅'} ${typeLabel}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Date & Time</td>
                  <td style="padding:8px 0;color:#e2e8f0;font-size:14px;font-weight:600">${formattedDate}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Timezone</td>
                  <td style="padding:8px 0;color:#e2e8f0;font-size:14px">${booking.timezone}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Platform</td>
                  <td style="padding:8px 0;color:#e2e8f0;font-size:14px">${platIcon} ${platLabel}</td>
                </tr>
                ${booking.company ? `<tr>
                  <td style="padding:8px 0;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Company</td>
                  <td style="padding:8px 0;color:#e2e8f0;font-size:14px">${booking.company}${booking.role ? ` · ${booking.role}` : ''}</td>
                </tr>` : ''}
              </table>
            </div>
            ${joinButton}
            <div style="background:#1e3a5f22;border:1px solid #1e40af44;border-radius:10px;padding:16px">
              <p style="margin:0 0 8px;color:#93c5fd;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">Quick Tips</p>
              <ul style="margin:0;padding-left:16px;color:#94a3b8;font-size:13px">
                <li style="margin-bottom:4px">Join 2–3 minutes early to test your audio & video</li>
                <li style="margin-bottom:4px">Use a quiet, well-lit space</li>
                <li>Have any questions or materials ready in advance</li>
              </ul>
            </div>
          </div>
          <div style="padding:20px 32px;border-top:1px solid #1e293b;text-align:center">
            <p style="margin:0;color:#475569;font-size:12px">
              Looking forward to speaking with you!<br/>
              <strong style="color:#94a3b8">Abhishek Singh</strong>
            </p>
            <p style="margin:8px 0 0;color:#334155;font-size:10px">Booking ID: ${booking.id}</p>
          </div>
        </div>
      </body>
      </html>
    `,
  })
}

/* ── Rejection email ─────────────────────────────────────────────────────── */
async function sendRejectionEmail(
  resend: Resend,
  booking: Awaited<ReturnType<typeof dbGetBooking>>
) {
  if (!booking) return
  const typeLabel = booking.type === 'interview' ? 'Interview' : 'Meeting'

  await resend.emails.send({
    from: await getFromEmail(),
    to: booking.email,
    subject: `Re: Your ${typeLabel} Request`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif">
        <div style="max-width:580px;margin:32px auto;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155">
          <div style="background:linear-gradient(135deg,#7f1d1d,#0f172a);padding:32px 32px 24px">
            <div style="font-size:36px;margin-bottom:8px">📋</div>
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">Update on Your ${typeLabel} Request</h1>
          </div>
          <div style="padding:28px 32px">
            <p style="color:#cbd5e1;font-size:15px">Hi <strong style="color:#f1f5f9">${booking.name}</strong>,</p>
            <p style="color:#94a3b8;font-size:14px">
              Thank you for reaching out. Unfortunately, I'm unable to confirm this ${typeLabel.toLowerCase()} at this time.
            </p>
            ${booking.rejection_reason ? `
            <div style="background:#450a0a22;border:1px solid #7f1d1d44;border-radius:10px;padding:16px;margin:20px 0">
              <p style="margin:0;color:#fca5a5;font-size:14px"><strong>Reason:</strong> ${booking.rejection_reason}</p>
            </div>` : ''}
            <p style="color:#94a3b8;font-size:14px">
              Please feel free to reach out again to schedule for a different time.
            </p>
          </div>
          <div style="padding:20px 32px;border-top:1px solid #1e293b;text-align:center">
            <p style="margin:0;color:#475569;font-size:12px">
              Best regards,<br/><strong style="color:#94a3b8">Abhishek Singh</strong>
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  })
}

/* ══════════════════════════════════════════════════════════════════════════
   PATCH — approve or reject
   Next.js 15/16: params is a Promise — must be awaited before use.
   ══════════════════════════════════════════════════════════════════════════ */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ── Auth check ────────────────────────────────────────────────────────────
  const sessionRes = await fetch(`${req.nextUrl.origin}/api/admin/session-check`, {
    headers: { cookie: req.headers.get('cookie') || '' },
  })
  if (!sessionRes.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Also check the JSON body (session-check returns 200 with { valid: false } on bad token)
  try {
    const sessionData = await sessionRes.clone().json()
    if (sessionData.valid === false) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } catch { /* session-check didn't return JSON — treat as valid */ }

  // ── Await params (required in Next.js 15+) ────────────────────────────────
  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: 'Missing booking ID' }, { status: 400 })
  }

  try {
    const body = await req.json()
    const { action, meetingLink, reason, adminNotes } = body

    /* ── APPROVE ── */
    if (action === 'approve') {
      // First verify the booking exists before attempting anything
      const existingBooking = await dbGetBooking(id)
      if (!existingBooking) {
        return NextResponse.json({ error: 'Booking not found', id }, { status: 404 })
      }

      let finalLink: string = meetingLink?.trim() || ''
      let autoGenerated = false

      // Auto-generate a meeting link if none supplied
      if (!finalLink) {
        try {
          const generated = await generateMeetingLink({
            name: existingBooking.name,
            email: existingBooking.email,
            proposed_date: existingBooking.proposed_date,
            timezone: existingBooking.timezone,
            type: existingBooking.type,
            platform: existingBooking.platform,
          })
          if (generated.link) {
            finalLink = generated.link
            autoGenerated = true
          }
        } catch (genErr) {
          console.error('[meetings approve] auto-generate failed:', genErr)
        }
      }

      const linkForApproval = finalLink || 'PENDING_LINK'
      const booking = await dbApproveBooking(id, linkForApproval, adminNotes)
      if (!booking) {
        return NextResponse.json({ error: 'Failed to update booking', id }, { status: 500 })
      }

      // Send confirmation email to visitor
      try {
        const resend = await getResend()
        if (resend) {
          await sendApprovalEmail(resend, booking)
          await dbMarkNotified(id)
        }
      } catch (emailErr) {
        console.error('[meetings approve] email failed:', emailErr)
        // Don't fail the whole request just because email failed
      }

      return NextResponse.json({
        success: true,
        booking,
        autoGenerated,
        pendingLink: !finalLink || finalLink === 'PENDING_LINK',
      })
    }

    /* ── REJECT ── */
    if (action === 'reject') {
      if (!reason?.trim()) {
        return NextResponse.json(
          { error: 'reason is required for rejection' },
          { status: 400 }
        )
      }

      // First verify the booking exists
      const existingBooking = await dbGetBooking(id)
      if (!existingBooking) {
        return NextResponse.json({ error: 'Booking not found', id }, { status: 404 })
      }

      const booking = await dbRejectBooking(id, reason.trim(), adminNotes)
      if (!booking) {
        return NextResponse.json({ error: 'Failed to update booking', id }, { status: 500 })
      }

      try {
        const resend = await getResend()
        if (resend) {
          await sendRejectionEmail(resend, booking)
          await dbMarkNotified(id)
        }
      } catch (emailErr) {
        console.error('[meetings reject] email failed:', emailErr)
      }

      return NextResponse.json({ success: true, booking })
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "approve" or "reject"' },
      { status: 400 }
    )
  } catch (e) {
    console.error('[meetings PATCH]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   DELETE — remove booking
   Next.js 15/16: params is a Promise — must be awaited.
   ══════════════════════════════════════════════════════════════════════════ */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionRes = await fetch(`${req.nextUrl.origin}/api/admin/session-check`, {
    headers: { cookie: req.headers.get('cookie') || '' },
  })
  if (!sessionRes.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    await dbDeleteBooking(id)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[meetings DELETE]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
