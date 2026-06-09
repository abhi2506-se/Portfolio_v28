/**
 * POST /api/meetings            — visitor submits a booking request
 * GET  /api/meetings            — admin lists all bookings (session required)
 */
import { NextRequest, NextResponse } from 'next/server'
import { dbCreateBooking, dbListBookings } from '@/lib/meeting-store'
import { dbGetSettings } from '@/lib/db'
import { Resend } from 'resend'
import { notifyAllAdmins } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

async function getResend() {
  try {
    const s = (await dbGetSettings()) as Record<string, string>
    const key = s.resend_api_key || process.env.RESEND_API_KEY || ''
    return key ? new Resend(key) : null
  } catch { return null }
}

async function getAdminEmail() {
  try {
    const s = (await dbGetSettings()) as Record<string, string>
    return s.notify_email || process.env.ADMIN_EMAIL || ''
  } catch { return '' }
}

async function getFromEmail() {
  try {
    const s = (await dbGetSettings()) as Record<string, string>
    return s.resend_from_email || process.env.RESEND_FROM_EMAIL || 'Portfolio <noreply@resend.dev>'
  } catch { return 'Portfolio <noreply@resend.dev>' }
}

/* ── POST: visitor creates a booking ──────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, name, email, company, role, message, proposed_date, timezone, platform } = body

    if (!name?.trim() || !email?.trim() || !proposed_date) {
      return NextResponse.json({ error: 'name, email and proposed_date are required' }, { status: 400 })
    }

    const validPlatforms = ['google_meet', 'zoom', 'teams', 'any']
    const safePlatform = validPlatforms.includes(platform) ? platform : 'any'

    const booking = await dbCreateBooking({
      type: type === 'interview' ? 'interview' : 'meeting',
      name: name.trim(), email: email.trim(),
      company: company?.trim() || undefined,
      role: role?.trim() || undefined,
      message: message?.trim() || undefined,
      proposed_date, timezone: timezone || 'UTC',
      platform: safePlatform,
    })

    const typeLabel = booking.type === 'interview' ? 'Interview' : 'Meeting'
    const formattedDate = new Date(booking.proposed_date).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

    // ── 1. Push notification to admin PWA ────────────────────────────────────
    try {
      await notifyAllAdmins({
        title: `📅 New ${typeLabel} Request`,
        body: `${booking.name} wants to schedule a ${typeLabel.toLowerCase()} on ${formattedDate}`,
        tag: `meeting-${booking.id}`,
        url: '/admin/dashboard#meetings',
      })
    } catch (pushErr) {
      console.error('[meetings] push notification failed:', pushErr)
    }

    // ── 2. Email notification to admin ───────────────────────────────────────
    try {
      const resend = await getResend()
      const adminEmail = await getAdminEmail()
      const fromEmail = await getFromEmail()
      if (resend && adminEmail) {
        await resend.emails.send({
          from: fromEmail,
          to: adminEmail,
          subject: `📅 New ${typeLabel} Request from ${booking.name}`,
          html: `
            <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:auto;background:#0f172a;color:#e2e8f0;border-radius:12px;overflow:hidden;border:1px solid #1e293b">
              <div style="background:linear-gradient(135deg,#1d4ed8,#0f172a);padding:28px 32px 20px">
                <div style="font-size:32px;margin-bottom:8px">📅</div>
                <h2 style="margin:0;color:#fff;font-size:20px;font-weight:700">New ${typeLabel} Request</h2>
                <p style="margin:4px 0 0;color:#93c5fd;font-size:13px">Someone wants to connect with you</p>
              </div>
              <div style="padding:24px 32px">
                <table style="width:100%;border-collapse:collapse">
                  <tr><td style="padding:8px 0;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;width:120px">Name</td><td style="padding:8px 0;color:#e2e8f0">${booking.name}</td></tr>
                  <tr><td style="padding:8px 0;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Email</td><td style="padding:8px 0;color:#e2e8f0">${booking.email}</td></tr>
                  ${booking.company ? `<tr><td style="padding:8px 0;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Company</td><td style="padding:8px 0;color:#e2e8f0">${booking.company}${booking.role ? ` · ${booking.role}` : ''}</td></tr>` : ''}
                  <tr><td style="padding:8px 0;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Proposed Date</td><td style="padding:8px 0;color:#e2e8f0;font-weight:600">${formattedDate}</td></tr>
                  <tr><td style="padding:8px 0;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Timezone</td><td style="padding:8px 0;color:#e2e8f0">${booking.timezone}</td></tr>
                  <tr><td style="padding:8px 0;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Platform</td><td style="padding:8px 0;color:#e2e8f0">${booking.platform ?? 'any'}</td></tr>
                  ${booking.message ? `<tr><td style="padding:8px 0;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Message</td><td style="padding:8px 0;color:#e2e8f0">${booking.message}</td></tr>` : ''}
                </table>
                <p style="margin-top:24px;text-align:center">
                  <a href="${process.env.NEXTAUTH_URL || ''}/admin/dashboard" style="background:#3b82f6;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
                    Review in Admin Panel →
                  </a>
                </p>
              </div>
              <div style="padding:16px 32px;border-top:1px solid #1e293b;text-align:center">
                <p style="margin:0;color:#475569;font-size:11px">Booking ID: ${booking.id}</p>
              </div>
            </div>
          `,
        })
      }
    } catch (emailErr) {
      console.error('[meetings] admin email failed:', emailErr)
    }

    // ── 3. Confirmation email to visitor ─────────────────────────────────────
    try {
      const resend = await getResend()
      const fromEmail = await getFromEmail()
      if (resend) {
        const formattedFull = new Date(booking.proposed_date).toLocaleString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })
        await resend.emails.send({
          from: fromEmail,
          to: booking.email,
          subject: `✅ ${typeLabel} Request Received — We'll confirm shortly!`,
          html: `
            <!DOCTYPE html>
            <html lang="en">
            <body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif">
              <div style="max-width:580px;margin:32px auto;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155">
                <div style="background:linear-gradient(135deg,#1d4ed8,#0f172a);padding:32px 32px 24px">
                  <div style="font-size:36px;margin-bottom:8px">🕒</div>
                  <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">${typeLabel} Request Received!</h1>
                  <p style="margin:6px 0 0;color:#93c5fd;font-size:14px">We'll review and confirm your request shortly</p>
                </div>
                <div style="padding:28px 32px">
                  <p style="margin:0 0 16px;color:#cbd5e1;font-size:15px">Hi <strong style="color:#f1f5f9">${booking.name}</strong>,</p>
                  <p style="margin:0 0 24px;color:#94a3b8;font-size:14px">
                    Your ${typeLabel.toLowerCase()} request for <strong style="color:#60a5fa">${formattedFull}</strong> has been received.
                    You'll receive a confirmation email once it's approved.
                  </p>
                  <div style="background:#0f172a;border:1px solid #1e40af;border-radius:12px;padding:20px;margin-bottom:24px">
                    <table style="width:100%;border-collapse:collapse">
                      <tr>
                        <td style="padding:8px 0;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;width:120px">Type</td>
                        <td style="padding:8px 0;color:#e2e8f0;font-size:14px">${booking.type === 'interview' ? '💼' : '📅'} ${typeLabel}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Date</td>
                        <td style="padding:8px 0;color:#e2e8f0;font-size:14px;font-weight:600">${formattedFull}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Timezone</td>
                        <td style="padding:8px 0;color:#e2e8f0;font-size:14px">${booking.timezone}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Status</td>
                        <td style="padding:8px 0;color:#fbbf24;font-size:14px;font-weight:600">⏳ Pending Review</td>
                      </tr>
                    </table>
                  </div>
                  <p style="color:#64748b;font-size:13px">
                    If you need to make changes, please contact us directly. 
                    A confirmation with your meeting link will be sent once approved.
                  </p>
                </div>
                <div style="padding:20px 32px;border-top:1px solid #1e293b;text-align:center">
                  <p style="margin:0;color:#475569;font-size:12px">
                    Looking forward to connecting!<br/>
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
    } catch (visitorEmailErr) {
      console.error('[meetings] visitor confirmation email failed:', visitorEmailErr)
    }

    return NextResponse.json({ success: true, bookingId: booking.id }, { status: 201 })
  } catch (e) {
    console.error('[meetings POST]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

/* ── GET: admin lists bookings ─────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  // Verify admin session
  const sessionRes = await fetch(`${req.nextUrl.origin}/api/admin/session-check`, {
    headers: { cookie: req.headers.get('cookie') || '' },
  })
  if (!sessionRes.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const status = req.nextUrl.searchParams.get('status') as any
    const bookings = await dbListBookings(status || undefined)
    return NextResponse.json({ bookings })
  } catch (e) {
    console.error('[meetings GET]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
