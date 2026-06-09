/**
 * POST /api/admin/test-email
 * Sends a test email to verify the Resend configuration is working.
 * Admin-only endpoint.
 */
import { NextRequest, NextResponse } from 'next/server'
import { dbGetSettings } from '@/lib/db'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

async function requireAdmin(req: NextRequest): Promise<boolean> {
  try {
    const res = await fetch(`${req.nextUrl.origin}/api/admin/session-check`, {
      headers: { cookie: req.headers.get('cookie') || '' },
    })
    if (!res.ok) return false
    const d = await res.json()
    return d.valid !== false
  } catch { return false }
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const s = (await dbGetSettings()) as Record<string, string>
    const apiKey = s.resend_api_key || process.env.RESEND_API_KEY || ''
    const adminEmail = s.notify_email || process.env.ADMIN_EMAIL || ''
    const fromEmail = s.resend_from_email || process.env.RESEND_FROM_EMAIL || 'Portfolio <noreply@resend.dev>'

    const diagnostics = {
      resend_api_key: apiKey ? `✅ Set (${apiKey.slice(0, 8)}…)` : '❌ Missing — set RESEND_API_KEY',
      admin_email: adminEmail || '❌ Missing — set ADMIN_EMAIL in settings',
      from_email: fromEmail,
    }

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        diagnostics,
        error: 'RESEND_API_KEY not configured. Go to Settings → Email and add your Resend API key.',
      })
    }

    if (!adminEmail) {
      return NextResponse.json({
        success: false,
        diagnostics,
        error: 'Admin email not configured. Go to Settings and add your email in the "Notification Email" field.',
      })
    }

    const resend = new Resend(apiKey)
    const result = await resend.emails.send({
      from: fromEmail,
      to: adminEmail,
      subject: '✅ Test Email — Portfolio Email System Working',
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:500px;margin:auto;background:#0f172a;color:#e2e8f0;border-radius:12px;overflow:hidden;padding:32px;border:1px solid #1e293b">
          <div style="font-size:36px;margin-bottom:16px">✅</div>
          <h2 style="margin:0 0 12px;color:#4ade80;font-size:20px">Email System is Working!</h2>
          <p style="color:#94a3b8;font-size:14px;margin:0 0 16px">
            Your Resend email configuration is correctly set up. Meeting request emails, approval/rejection emails, and reminder emails will be delivered successfully.
          </p>
          <div style="background:#1e293b;border-radius:8px;padding:16px;font-size:12px;color:#64748b">
            <p style="margin:0"><strong style="color:#94a3b8">From:</strong> ${fromEmail}</p>
            <p style="margin:8px 0 0"><strong style="color:#94a3b8">To:</strong> ${adminEmail}</p>
            <p style="margin:8px 0 0"><strong style="color:#94a3b8">Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
        </div>
      `,
    })

    return NextResponse.json({
      success: true,
      diagnostics,
      message: `Test email sent to ${adminEmail}! Check your inbox.`,
      resend_id: (result as any)?.data?.id,
    })
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: e?.message || 'Failed to send test email',
      hint: 'Common issues: Invalid API key, unverified "from" domain, or rate limit exceeded.',
    }, { status: 500 })
  }
}
