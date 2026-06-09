import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import nodemailer from 'nodemailer'
import { verifyToken } from '@/lib/admin-auth'
import { sendPushToAdmin } from '@/lib/notifications'

const SESSION_COOKIE = 'portfolio_admin_session'
const sql = neon(process.env.DATABASE_URL!)

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
})

// ── In-memory typing state (expires after 4 seconds) ─────────────────────────
const typingState = new Map<string, { role: 'user' | 'admin'; ts: number }>()
const TYPING_TTL = 4000 // ms

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS live_chats (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    user_name TEXT NOT NULL DEFAULT 'Visitor',
    user_email TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  )`
  await sql`CREATE TABLE IF NOT EXISTS live_chat_messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at BIGINT NOT NULL
  )`
}

function isAdminAuthed(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE)
  return cookie?.value && verifyToken(cookie.value)
}

// POST /api/live-chat — user sends message or starts chat
export async function POST(req: NextRequest) {
  try {
    await ensureTable()
    const body = await req.json()
    const { action } = body

    // ── Start new chat request ──────────────────────────────────────────────
    if (action === 'start') {
      const { userName, userEmail, sessionId, initialMessage } = body
      if (!userName?.trim() || !initialMessage?.trim()) {
        return NextResponse.json({ error: 'Name and message required' }, { status: 400 })
      }
      const chatId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      const now = Date.now()

      await sql`INSERT INTO live_chats (id, session_id, user_name, user_email, status, created_at, updated_at)
        VALUES (${chatId}, ${sessionId || ''}, ${userName.trim().slice(0, 100)}, ${(userEmail || '').trim().slice(0, 200)}, 'pending', ${now}, ${now})`

      await sql`INSERT INTO live_chat_messages (id, chat_id, role, content, created_at)
        VALUES (${msgId}, ${chatId}, 'user', ${initialMessage.trim().slice(0, 2000)}, ${now})`

      // Email admin instantly
      if (process.env.SMTP_USER && process.env.SMTP_PASS && process.env.ADMIN_EMAIL) {
        const receivedAt = new Date(now).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Kolkata' })
        const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 16px;">
  <div style="background:linear-gradient(135deg,#7c3aed,#2563eb);border-radius:16px 16px 0 0;padding:28px 32px;">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">💬 Live Chat Request</h1>
    <p style="margin:6px 0 0;color:#c4b5fd;font-size:14px;">A visitor wants to chat with you live!</p>
  </div>
  <div style="background:#1e293b;border-radius:0 0 16px 16px;padding:28px 32px;border:1px solid #334155;border-top:none;">
    <div style="background:#0f172a;border-radius:10px;padding:16px 20px;margin-bottom:20px;border-left:3px solid #7c3aed;">
      <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;">From</p>
      <p style="margin:0 0 4px;color:#f1f5f9;font-weight:600;">${userName.trim()}</p>
      ${userEmail ? `<p style="margin:0;color:#60a5fa;font-size:13px;">${(userEmail || '').trim()}</p>` : ''}
      <p style="margin:12px 0 8px;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;">Message</p>
      <p style="margin:0;color:#cbd5e1;font-size:14px;line-height:1.7;">${initialMessage.trim().replace(/\n/g, '<br>')}</p>
    </div>
    <div style="background:#0f172a;border-radius:10px;padding:12px 20px;margin-bottom:24px;">
      <p style="margin:0;color:#64748b;font-size:12px;">⏰ Received: <strong style="color:#94a3b8;">${receivedAt}</strong></p>
    </div>
    <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://portfolio-v7-mauve.vercel.app'}/admin/dashboard" style="display:block;text-align:center;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;font-weight:600;font-size:14px;padding:14px;border-radius:10px;text-decoration:none;">
      Open Admin Panel to Chat →
    </a>
  </div>
  <p style="text-align:center;color:#475569;font-size:12px;margin-top:16px;">Abhishek Singh Portfolio — Live Chat Notification</p>
</div></body></html>`
        transporter.sendMail({
          from: `"Portfolio Live Chat" <${process.env.SMTP_USER}>`,
          to: process.env.ADMIN_EMAIL,
          subject: `💬 Live Chat Request from ${userName.trim()}`,
          html,
        }).catch(() => {})
      }

      // Push notification for new live chat request
      sendPushToAdmin({
        title: '🟢 New Live Chat Request!',
        body: `${userName.trim()}: "${initialMessage.trim().slice(0, 80)}${initialMessage.length > 80 ? '…' : ''}"`,
        tag: `live-chat-start-${chatId}`,
        url: '/admin',
      }).catch(() => {})

      return NextResponse.json({ ok: true, chatId })
    }

    // ── User sends message in existing chat ─────────────────────────────────
    if (action === 'message') {
      const { chatId, content } = body
      if (!chatId || !content?.trim()) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
      const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      const now = Date.now()
      await sql`INSERT INTO live_chat_messages (id, chat_id, role, content, created_at)
        VALUES (${msgId}, ${chatId}, 'user', ${content.trim().slice(0, 2000)}, ${now})`
      await sql`UPDATE live_chats SET updated_at = ${now} WHERE id = ${chatId}`

      // Get user name for notification
      const chatRows = await sql`SELECT user_name FROM live_chats WHERE id = ${chatId}`
      const visitorName = chatRows[0]?.user_name || 'Visitor'
      sendPushToAdmin({
        title: '💬 Live Chat Message',
        body: `${visitorName}: "${content.trim().slice(0, 80)}${content.length > 80 ? '…' : ''}"`,
        tag: `live-chat-${chatId}`,
        url: '/admin',
      }).catch(() => {})

      return NextResponse.json({ ok: true })
    }

    // ── Admin replies ────────────────────────────────────────────────────────
    if (action === 'admin_reply') {
      if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      const { chatId, content } = body
      if (!chatId || !content?.trim()) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
      const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      const now = Date.now()
      await sql`INSERT INTO live_chat_messages (id, chat_id, role, content, created_at)
        VALUES (${msgId}, ${chatId}, 'admin', ${content.trim().slice(0, 2000)}, ${now})`
      await sql`UPDATE live_chats SET updated_at = ${now}, status = 'active' WHERE id = ${chatId}`
      return NextResponse.json({ ok: true })
    }

    // ── Admin accepts/closes chat ────────────────────────────────────────────
    if (action === 'update_status') {
      if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      const { chatId, status } = body
      if (!chatId || !status) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
      await sql`UPDATE live_chats SET status = ${status}, updated_at = ${Date.now()} WHERE id = ${chatId}`
      return NextResponse.json({ ok: true })
    }

    // ── Typing indicator ─────────────────────────────────────────────────────
    if (action === 'typing') {
      const { chatId, role } = body
      if (!chatId || !role) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
      if (role === 'admin' && !isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      typingState.set(chatId, { role, ts: Date.now() })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    console.error('[live-chat] POST error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// GET /api/live-chat — poll messages
export async function GET(req: NextRequest) {
  try {
    await ensureTable()
    const { searchParams } = new URL(req.url)
    const chatId = searchParams.get('chatId')
    const adminMode = searchParams.get('admin')

    // Admin: get all active chats
    if (adminMode === '1') {
      if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      const chats = await sql`SELECT * FROM live_chats WHERE status != 'closed' ORDER BY updated_at DESC LIMIT 50`
      const result = await Promise.all(chats.map(async (chat: any) => {
        const msgs = await sql`SELECT * FROM live_chat_messages WHERE chat_id = ${chat.id} ORDER BY created_at ASC`
        // Attach typing state
        const typing = typingState.get(chat.id)
        const isTyping = typing && (Date.now() - typing.ts) < TYPING_TTL ? typing.role : null
        return { ...chat, messages: msgs, typingRole: isTyping }
      }))
      return NextResponse.json({ chats: result })
    }

    // User: get messages for their chat
    if (chatId) {
      const msgs = await sql`SELECT * FROM live_chat_messages WHERE chat_id = ${chatId} ORDER BY created_at ASC`
      const chat = await sql`SELECT status FROM live_chats WHERE id = ${chatId} LIMIT 1`
      // Attach typing state — user sees admin typing
      const typing = typingState.get(chatId)
      const adminTyping = typing && typing.role === 'admin' && (Date.now() - typing.ts) < TYPING_TTL
      return NextResponse.json({ messages: msgs, status: chat[0]?.status || 'pending', adminTyping })
    }

    return NextResponse.json({ error: 'Missing chatId' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
