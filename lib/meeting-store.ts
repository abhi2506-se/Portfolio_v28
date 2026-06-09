/**
 * Meeting booking database helpers
 * Uses the existing Neon/Postgres connection via getDB() from db.ts
 *
 * v2 additions:
 *  - `platform`          TEXT  — user preferred platform: 'google_meet' | 'zoom' | 'teams' | 'any'
 *  - `platform_link`     TEXT  — auto-generated meeting link (separate from admin-supplied link)
 */
import { getDB } from './db'

export type MeetingStatus   = 'pending' | 'approved' | 'rejected'
export type MeetingType     = 'meeting' | 'interview'
export type MeetingPlatform = 'google_meet' | 'zoom' | 'teams' | 'any'

export interface MeetingBooking {
  id: string
  type: MeetingType
  name: string
  email: string
  company?: string
  role?: string
  message?: string
  proposed_date: string
  timezone: string
  platform: MeetingPlatform
  status: MeetingStatus
  meeting_link?: string
  rejection_reason?: string
  admin_notes?: string
  notified: boolean
  created_at: string
  updated_at: string
}

/* ─── Ensure table exists (idempotent) ──────────────────────────────────────── */
export async function ensureMeetingTable() {
  const db = await getDB()
  await db`
    CREATE TABLE IF NOT EXISTS meeting_bookings (
      id               TEXT PRIMARY KEY,
      type             TEXT NOT NULL DEFAULT 'meeting',
      name             TEXT NOT NULL,
      email            TEXT NOT NULL,
      company          TEXT,
      role             TEXT,
      message          TEXT,
      proposed_date    TEXT NOT NULL,
      timezone         TEXT NOT NULL DEFAULT 'UTC',
      platform         TEXT NOT NULL DEFAULT 'any',
      status           TEXT NOT NULL DEFAULT 'pending',
      meeting_link     TEXT,
      rejection_reason TEXT,
      admin_notes      TEXT,
      notified         BOOLEAN NOT NULL DEFAULT false,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  // Non-destructive migration for existing tables created without platform column
  try {
    await db`ALTER TABLE meeting_bookings ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'any'`
  } catch { /* column already exists — ignore */ }
}

/* ─── Create booking ───────────────────────────────────────────────────────── */
export async function dbCreateBooking(
  data: Omit<MeetingBooking, 'id' | 'status' | 'notified' | 'created_at' | 'updated_at'>
): Promise<MeetingBooking> {
  await ensureMeetingTable()
  const db = await getDB()
  const id = `booking_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const rows = await db`
    INSERT INTO meeting_bookings
      (id, type, name, email, company, role, message, proposed_date, timezone, platform)
    VALUES (
      ${id}, ${data.type}, ${data.name}, ${data.email},
      ${data.company ?? null}, ${data.role ?? null}, ${data.message ?? null},
      ${data.proposed_date}, ${data.timezone}, ${data.platform ?? 'any'}
    )
    RETURNING *
  `
  return rows[0] as MeetingBooking
}

/* ─── List bookings ────────────────────────────────────────────────────────── */
export async function dbListBookings(status?: MeetingStatus): Promise<MeetingBooking[]> {
  await ensureMeetingTable()
  const db = await getDB()
  if (status) {
    const rows = await db`SELECT * FROM meeting_bookings WHERE status = ${status} ORDER BY created_at DESC`
    return rows as MeetingBooking[]
  }
  const rows = await db`SELECT * FROM meeting_bookings ORDER BY created_at DESC`
  return rows as MeetingBooking[]
}

/* ─── Get single booking ───────────────────────────────────────────────────── */
export async function dbGetBooking(id: string): Promise<MeetingBooking | null> {
  await ensureMeetingTable()
  const db = await getDB()
  const rows = await db`SELECT * FROM meeting_bookings WHERE id = ${id}`
  return (rows[0] as MeetingBooking) ?? null
}

/* ─── Approve booking ──────────────────────────────────────────────────────── */
export async function dbApproveBooking(
  id: string,
  meetingLink: string,
  adminNotes?: string
): Promise<MeetingBooking | null> {
  await ensureMeetingTable()
  const db = await getDB()
  const rows = await db`
    UPDATE meeting_bookings
    SET status = 'approved', meeting_link = ${meetingLink}, admin_notes = ${adminNotes ?? null}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `
  const booking = (rows[0] as MeetingBooking) ?? null

  // ── Schedule reminder 30 min before meeting ─────────────────────────────
  if (booking && booking.proposed_date) {
    try {
      const { dbCreateReminder } = await import('./db')
      const meetingTime = new Date(booking.proposed_date)
      const reminderTime = new Date(meetingTime.getTime() - 30 * 60 * 1000)
      if (reminderTime > new Date()) {
        await dbCreateReminder(id, reminderTime)
      }
    } catch (e) {
      console.error('[meeting-store] reminder scheduling failed:', e)
    }
  }

  return booking
}

/* ─── Reject booking ───────────────────────────────────────────────────────── */
export async function dbRejectBooking(
  id: string,
  reason: string,
  adminNotes?: string
): Promise<MeetingBooking | null> {
  await ensureMeetingTable()
  const db = await getDB()
  const rows = await db`
    UPDATE meeting_bookings
    SET status = 'rejected', rejection_reason = ${reason}, admin_notes = ${adminNotes ?? null}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `
  return (rows[0] as MeetingBooking) ?? null
}

/* ─── Mark notified ────────────────────────────────────────────────────────── */
export async function dbMarkNotified(id: string): Promise<void> {
  await ensureMeetingTable()
  const db = await getDB()
  await db`UPDATE meeting_bookings SET notified = true WHERE id = ${id}`
}

/* ─── Delete booking ───────────────────────────────────────────────────────── */
export async function dbDeleteBooking(id: string): Promise<void> {
  await ensureMeetingTable()
  const db = await getDB()
  await db`DELETE FROM meeting_bookings WHERE id = ${id}`
}
