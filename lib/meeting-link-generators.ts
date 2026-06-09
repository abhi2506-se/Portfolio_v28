/**
 * Meeting link generator utilities
 * Exported so they can be used both in the generate-link API route
 * and directly from the approve route (no internal HTTP needed).
 */

export function uniqueRoomId(prefix = 'meeting'): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz'
  const rand = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `portfolio-${prefix}-${rand(3)}-${rand(3)}-${rand(3)}`
}

export function generateJitsiLink(type: string): string {
  const prefix = type === 'interview' ? 'interview' : 'meet'
  return `https://meet.jit.si/${uniqueRoomId(prefix)}`
}

export async function generateGoogleMeetLink(booking: {
  name: string; email: string; proposed_date: string; timezone: string; type: string
}): Promise<string | null> {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
  const privateKey  = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const calendarId  = process.env.GOOGLE_CALENDAR_ID || 'primary'

  if (!clientEmail || !privateKey) return null

  try {
    const { google } = await import('googleapis')
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    })
    const calendar = google.calendar({ version: 'v3', auth })
    const startTime = new Date(booking.proposed_date)
    const endTime   = new Date(startTime.getTime() + 60 * 60 * 1000)
    const requestId = `portfolio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const event = await calendar.events.insert({
      calendarId,
      conferenceDataVersion: 1,
      requestBody: {
        summary: `${booking.type === 'interview' ? '💼 Interview' : '📅 Meeting'} with ${booking.name}`,
        description: `Auto-scheduled via portfolio booking system.\nAttendee: ${booking.email}`,
        start: { dateTime: startTime.toISOString(), timeZone: booking.timezone },
        end:   { dateTime: endTime.toISOString(),   timeZone: booking.timezone },
        attendees: [{ email: booking.email }],
        conferenceData: {
          createRequest: { requestId, conferenceSolutionKey: { type: 'hangoutsMeet' } },
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 15 },
          ],
        },
      },
    })
    return event.data.conferenceData?.entryPoints?.[0]?.uri ?? null
  } catch (err) {
    console.error('[meeting-link] Google Meet error:', err)
    return null
  }
}

export async function generateZoomLink(booking: {
  name: string; proposed_date: string; timezone: string; type: string
}): Promise<string | null> {
  const accountId    = process.env.ZOOM_ACCOUNT_ID
  const clientId     = process.env.ZOOM_CLIENT_ID
  const clientSecret = process.env.ZOOM_CLIENT_SECRET

  if (!accountId || !clientId || !clientSecret) return null

  try {
    const tokenRes = await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )
    if (!tokenRes.ok) throw new Error(`Zoom token error: ${tokenRes.status}`)
    const { access_token } = await tokenRes.json()

    const meetingRes = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: `${booking.type === 'interview' ? 'Interview' : 'Meeting'} with ${booking.name}`,
        type: 2,
        start_time: new Date(booking.proposed_date).toISOString(),
        duration: 60,
        timezone: booking.timezone,
        settings: { waiting_room: true, join_before_host: false, host_video: true, participant_video: true },
      }),
    })
    if (!meetingRes.ok) throw new Error(`Zoom meeting error: ${meetingRes.status}`)
    const data = await meetingRes.json()
    return (data.join_url as string) ?? null
  } catch (err) {
    console.error('[meeting-link] Zoom error:', err)
    return null
  }
}

export async function generateTeamsLink(booking: {
  name: string; proposed_date: string; timezone: string; type: string
}): Promise<string | null> {
  const tenantId     = process.env.AZURE_TENANT_ID
  const clientId     = process.env.AZURE_CLIENT_ID
  const clientSecret = process.env.AZURE_CLIENT_SECRET
  const userId       = process.env.TEAMS_USER_ID

  if (!tenantId || !clientId || !clientSecret || !userId) return null

  try {
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
          scope: 'https://graph.microsoft.com/.default',
        }),
      }
    )
    if (!tokenRes.ok) throw new Error(`Teams token error: ${tokenRes.status}`)
    const { access_token } = await tokenRes.json()

    const startDt = new Date(booking.proposed_date)
    const endDt   = new Date(startDt.getTime() + 60 * 60 * 1000)

    const meetingRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${userId}/onlineMeetings`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: `${booking.type === 'interview' ? '💼 Interview' : '📅 Meeting'} with ${booking.name}`,
          startDateTime: startDt.toISOString(),
          endDateTime:   endDt.toISOString(),
        }),
      }
    )
    if (!meetingRes.ok) throw new Error(`Teams meeting error: ${meetingRes.status}`)
    const data = await meetingRes.json()
    return (data.joinWebUrl as string) ?? null
  } catch (err) {
    console.error('[meeting-link] Teams error:', err)
    return null
  }
}

/**
 * Generate a meeting link based on the preferred platform.
 * Falls back to Jitsi if no API credentials are configured.
 */
export async function generateMeetingLink(booking: {
  name: string; email: string; proposed_date: string; timezone: string; type: string; platform?: string
}): Promise<{ link: string; platform: string; usedApi: boolean; message: string }> {
  const platform = booking.platform ?? 'any'
  let link: string | null = null
  let usedPlatform = ''
  let usedApi = false

  if (platform === 'google_meet') {
    link = await generateGoogleMeetLink(booking)
    if (link) { usedPlatform = 'google_meet'; usedApi = true }
  } else if (platform === 'zoom') {
    link = await generateZoomLink(booking)
    if (link) { usedPlatform = 'zoom'; usedApi = true }
  } else if (platform === 'teams') {
    link = await generateTeamsLink(booking)
    if (link) { usedPlatform = 'teams'; usedApi = true }
  }

  if (!link) {
    // Try Google → Zoom → Teams in order; fall through to Jitsi if none configured
    link = await generateGoogleMeetLink(booking)
    if (link) { usedPlatform = 'google_meet'; usedApi = true }
  }
  if (!link) {
    link = await generateZoomLink(booking)
    if (link) { usedPlatform = 'zoom'; usedApi = true }
  }
  if (!link) {
    link = await generateTeamsLink(booking)
    if (link) { usedPlatform = 'teams'; usedApi = true }
  }

  // Jitsi fallback — always works
  if (!link) {
    link = generateJitsiLink(booking.type)
    usedPlatform = 'jitsi'
    usedApi = false
  }

  const platformLabels: Record<string, string> = {
    google_meet: 'Google Meet',
    zoom: 'Zoom',
    teams: 'Microsoft Teams',
    jitsi: 'Jitsi Meet',
  }

  return {
    link,
    platform: usedPlatform,
    usedApi,
    message: usedApi
      ? `✅ ${platformLabels[usedPlatform] ?? usedPlatform} link generated via API`
      : `✅ Jitsi Meet link generated (free, no sign-in required). To use Google Meet / Zoom / Teams, configure env vars.`,
  }
}
