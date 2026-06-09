'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar, Clock, User, Mail, Building2, Briefcase,
  MessageSquare, CheckCircle2, X, Loader2, Video,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BookingFormProps {
  defaultType?: 'meeting' | 'interview'
  onClose?: () => void
}

const TIMEZONES = [
  'Asia/Kolkata', 'America/New_York', 'America/Los_Angeles', 'America/Chicago',
  'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Asia/Singapore',
  'Asia/Tokyo', 'Australia/Sydney', 'UTC',
]

type Platform = 'google_meet' | 'zoom' | 'teams' | 'any'

const PLATFORMS: { value: Platform; label: string; icon: string; color: string }[] = [
  { value: 'google_meet', label: 'Google Meet', icon: '🟢', color: 'hover:border-green-500/60'  },
  { value: 'zoom',        label: 'Zoom',        icon: '🔵', color: 'hover:border-blue-500/60'   },
  { value: 'teams',       label: 'MS Teams',    icon: '🟣', color: 'hover:border-purple-500/60' },
  { value: 'any',         label: 'Any',         icon: '📹', color: 'hover:border-white/30'       },
]

export function MeetingBookingForm({ defaultType = 'meeting', onClose }: BookingFormProps) {
  const [type, setType]               = useState<'meeting' | 'interview'>(defaultType)
  const [name, setName]               = useState('')
  const [email, setEmail]             = useState('')
  const [company, setCompany]         = useState('')
  const [role, setRole]               = useState('')
  const [message, setMessage]         = useState('')
  const [proposedDate, setProposedDate] = useState('')
  const [timezone, setTimezone]       = useState('Asia/Kolkata')
  const [platform, setPlatform]       = useState<Platform>('google_meet')
  const [loading, setLoading]         = useState(false)
  const [success, setSuccess]         = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email || !proposedDate) { setError('Please fill in all required fields'); return }
    setLoading(true); setError(null)

    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type, name, email, company, role, message,
          proposed_date: proposedDate,
          timezone,
          platform,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit')
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally { setLoading(false) }
  }

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-8 px-4 space-y-4"
      >
        <div className="w-16 h-16 bg-green-500/20 border border-green-500/40 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-green-400" />
        </div>
        <h3 className="text-xl font-bold text-white">Request Submitted!</h3>
        <p className="text-white/60 text-sm max-w-sm mx-auto">
          Your {type} request has been received. You'll instantly receive a confirmation email
          with your {PLATFORMS.find(p => p.value === platform)?.label ?? 'meeting'} link
          once it's approved — usually within 24 hours.
        </p>
        <Button onClick={onClose} variant="outline" className="mt-2">Close</Button>
      </motion.div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 p-1">

      {/* Type toggle */}
      <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
        {(['meeting', 'interview'] as const).map(t => (
          <button
            key={t} type="button"
            onClick={() => setType(t)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all capitalize ${
              type === t
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-white/50 hover:text-white'
            }`}
          >
            {t === 'meeting' ? '📅 Meeting' : '💼 Interview'}
          </button>
        ))}
      </div>

      {/* Name + Email */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-white/60 mb-1.5">Full Name *</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text" value={name} onChange={e => setName(e.target.value)} required
              placeholder="Your name"
              className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/60 transition-colors"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-white/60 mb-1.5">Email *</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="your@email.com"
              className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/60 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Company + Role (interview only) */}
      <AnimatePresence>
        {type === 'interview' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-hidden"
          >
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5">Company</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="Company name"
                  className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/60 transition-colors" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5">Role / Position</label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input type="text" value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Frontend Engineer"
                  className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/60 transition-colors" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Date/time + Timezone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-white/60 mb-1.5">Proposed Date & Time *</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="datetime-local" value={proposedDate} onChange={e => setProposedDate(e.target.value)} required
              min={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)}
              className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/60 transition-colors [color-scheme:dark]"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-white/60 mb-1.5">Timezone</label>
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <select
              value={timezone} onChange={e => setTimezone(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/60 transition-colors appearance-none"
            >
              {TIMEZONES.map(tz => <option key={tz} value={tz} className="bg-slate-900">{tz}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Platform preference — NEW */}
      <div>
        <label className="block text-xs font-medium text-white/60 mb-2 flex items-center gap-1.5">
          <Video className="w-3.5 h-3.5" /> Preferred Platform
        </label>
        <div className="grid grid-cols-4 gap-2">
          {PLATFORMS.map(p => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPlatform(p.value)}
              className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg border text-xs font-medium transition-all ${
                platform === p.value
                  ? 'border-blue-500/60 bg-blue-600/20 text-white'
                  : `border-white/10 bg-white/5 text-white/50 ${p.color}`
              }`}
            >
              <span className="text-base leading-none">{p.icon}</span>
              <span className="leading-none text-[10px]">{p.label}</span>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-white/30 mt-1.5">
          A link will be auto-generated and emailed to you upon approval.
        </p>
      </div>

      {/* Message */}
      <div>
        <label className="block text-xs font-medium text-white/60 mb-1.5">
          {type === 'interview' ? 'About the role / additional context' : 'What would you like to discuss?'}
        </label>
        <div className="relative">
          <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-white/30" />
          <textarea
            value={message} onChange={e => setMessage(e.target.value)} rows={3}
            placeholder={type === 'interview' ? 'Brief description of the role, company, interview round...' : 'Topics to discuss, agenda, any special requirements...'}
            className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/60 transition-colors resize-none"
          />
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm"
        >
          <X className="w-4 h-4 flex-shrink-0" /> {error}
        </motion.div>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 gap-2"
      >
        {loading
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
          : `📅 Request ${type === 'interview' ? 'Interview' : 'Meeting'}`}
      </Button>

      <p className="text-center text-xs text-white/30">
        You'll receive an instant confirmation email with your {PLATFORMS.find(p => p.value === platform)?.label} link once approved.
      </p>
    </form>
  )
}
