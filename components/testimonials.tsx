'use client'

import { useRef, useState, useEffect } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { Quote, Star, Linkedin, ExternalLink, Plus, X, Upload, CheckCircle, AlertCircle, Loader2, ChevronUp } from 'lucide-react'

interface Testimonial {
  id: string
  name: string
  job_title: string
  company: string
  text: string
  photo_url: string
  rating: number
  linkedin_url: string
  status: string
  created_at: number
}

const defaultTestimonials: Testimonial[] = [
  {
    id: '1',
    name: 'Rajiv Mehta',
    job_title: 'Engineering Manager',
    company: 'Ksolves India Limited',
    text: "Abhishek consistently delivered high-quality React components ahead of schedule. His attention to UI detail and ability to translate Figma designs pixel-perfectly made him stand out. He proactively fixed edge cases we hadn't even spec'd out.",
    photo_url: '',
    rating: 5,
    linkedin_url: '',
    status: 'approved',
    created_at: Date.now(),
  },
  {
    id: '2',
    name: 'Priya Sharma',
    job_title: 'Senior Frontend Developer',
    company: 'Ksolves India Limited',
    text: "Working alongside Abhishek was a pleasure. He picked up our internal toolchain in days, not weeks, and was always the first to volunteer for challenging tasks. His Redux state management work significantly reduced our data-fetching bugs.",
    photo_url: '',
    rating: 5,
    linkedin_url: '',
    status: 'approved',
    created_at: Date.now(),
  },
  {
    id: '3',
    name: 'Ankit Verma',
    job_title: 'Tech Lead',
    company: 'Amazon Development Center India',
    text: "Abhishek demonstrated strong ownership of his deliverables at Amazon. The 35% rendering efficiency boost he achieved on our dashboard components was measurable and meaningful. He communicates blockers early and collaborates well under pressure.",
    photo_url: '',
    rating: 5,
    linkedin_url: '',
    status: 'approved',
    created_at: Date.now(),
  },
]

const GRADIENT_COLORS = [
  'from-blue-600 to-cyan-500',
  'from-purple-600 to-pink-500',
  'from-orange-600 to-red-500',
  'from-green-600 to-teal-500',
  'from-sky-600 to-blue-500',
  'from-indigo-600 to-violet-500',
]

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function getGradient(name: string) {
  const idx = name.charCodeAt(0) % GRADIENT_COLORS.length
  return GRADIENT_COLORS[idx]
}

interface InlineFormProps {
  onClose: () => void
  onSuccess: () => void
}

function InlineSubmitForm({ onClose, onSuccess }: InlineFormProps) {
  const [form, setForm] = useState({ name: '', job_title: '', company: '', text: '', linkedin_url: '', rating: 5 })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Scroll smoothly to the form when it opens
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }, [])

  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }))

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setError('Photo must be under 2MB'); return }
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.job_title.trim() || !form.company.trim() || !form.text.trim()) {
      setError('Please fill in all required fields.')
      return
    }
    if (form.text.trim().length < 30) {
      setError('Testimonial must be at least 30 characters.')
      return
    }
    setSubmitting(true)
    setError('')

    let photo_url = ''
    if (photoPreview) {
      photo_url = photoPreview
    }

    try {
      const res = await fetch('/api/testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, photo_url }),
      })
      const data = await res.json()
      if (data.ok) {
        setSuccess(true)
        setTimeout(() => { onSuccess(); onClose() }, 2000)
      } else {
        setError(data.error || 'Failed to submit. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      ref={formRef}
      initial={{ opacity: 0, y: -20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.98 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="w-full bg-card border border-blue-500/30 rounded-2xl shadow-xl overflow-hidden mb-10"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-blue-600/10 to-cyan-500/10">
        <div>
          <h3 className="font-bold text-lg">Share Your Experience</h3>
          <p className="text-xs text-muted-foreground">Your testimonial will be reviewed before publishing</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {success ? (
        <div className="p-8 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h4 className="font-bold text-lg mb-1">Thank You!</h4>
          <p className="text-sm text-muted-foreground">Your testimonial has been submitted and is pending approval. It will go live once reviewed.</p>
        </div>
      ) : (
        <div className="p-6 space-y-4">
          {/* Photo upload */}
          <div className="flex items-center gap-4">
            <div className="relative">
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="w-16 h-16 rounded-full object-cover border-2 border-blue-500/50" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center border-2 border-dashed border-border">
                  <Upload className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              <label className="absolute inset-0 cursor-pointer rounded-full" title="Upload photo">
                <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
              </label>
            </div>
            <div>
              <p className="text-sm font-medium">Profile Photo <span className="text-muted-foreground">(optional)</span></p>
              <p className="text-xs text-muted-foreground">Click to upload · Max 2MB</p>
            </div>
          </div>

          {/* Star rating */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Rating *</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} onClick={() => set('rating', s)} className="transition-transform hover:scale-110">
                  <Star className={`w-6 h-6 ${s <= form.rating ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground'}`} />
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Full Name *</label>
              <input
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="John Smith"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
              />
            </div>

            {/* Job Title */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Current Job Title *</label>
              <input
                value={form.job_title}
                onChange={e => set('job_title', e.target.value)}
                placeholder="Senior Software Engineer"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* Company */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Company Name *</label>
              <input
                value={form.company}
                onChange={e => set('company', e.target.value)}
                placeholder="Acme Corp"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
              />
            </div>

            {/* LinkedIn */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">LinkedIn Profile <span className="text-muted-foreground">(optional)</span></label>
              <input
                value={form.linkedin_url}
                onChange={e => set('linkedin_url', e.target.value)}
                placeholder="https://linkedin.com/in/yourname"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
              />
            </div>
          </div>

          {/* Testimonial text */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Your Testimonial *</label>
            <textarea
              value={form.text}
              onChange={e => set('text', e.target.value)}
              rows={4}
              placeholder="Share your experience working with or knowing this person..."
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">{form.text.length}/500 characters (min 30)</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl border border-border text-muted-foreground text-sm font-medium hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : 'Submit Testimonial'}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}

export function Testimonials() {
  const ref = useRef(null)
  const sectionRef = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const [testimonials, setTestimonials] = useState<Testimonial[]>([])
  const [loading, setLoading] = useState(true)
  const [usingDefault, setUsingDefault] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const fetchTestimonials = async () => {
    try {
      const res = await fetch('/api/testimonials', { cache: 'no-store' })
      const data = await res.json()
      if (data.testimonials && data.testimonials.length > 0) {
        setTestimonials(data.testimonials)
        setUsingDefault(false)
      } else {
        setTestimonials(defaultTestimonials)
        setUsingDefault(true)
      }
    } catch {
      setTestimonials(defaultTestimonials)
      setUsingDefault(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTestimonials()
  }, [])

  const handleAddClick = () => {
    setShowForm(true)
    // Scroll to section top so the inline form is visible
    setTimeout(() => {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  const container = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.12 } } }
  const card = { hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] } } }

  return (
    <motion.section
      ref={(el) => {
        // Assign to both refs
        ;(ref as any).current = el
        ;(sectionRef as any).current = el
      }}
      id="testimonials"
      className="py-20 md:py-32 px-4 md:px-6 lg:px-8 max-w-5xl mx-auto"
      variants={container} initial="hidden" animate={inView ? 'visible' : 'hidden'}
    >
      <motion.div variants={card} className="mb-4 flex items-start justify-between flex-wrap gap-4">
        <div>
          <span className="text-sm font-semibold text-blue-600 uppercase tracking-widest">Social Proof</span>
          <h2 className="text-4xl md:text-5xl font-bold mt-2">
            What People{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">Say</span>
          </h2>
        </div>
        {!showForm && (
          <button
            onClick={handleAddClick}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity mt-4"
          >
            <Plus className="w-4 h-4" />
            Add Testimonial
          </button>
        )}
      </motion.div>
      <motion.p variants={card} className="text-muted-foreground text-lg mb-10 max-w-2xl">
        Feedback from managers, team leads, and colleagues I've had the privilege of working with.
      </motion.p>

      {/* Inline form — appears right below heading, above cards */}
      <AnimatePresence>
        {showForm && (
          <InlineSubmitForm
            onClose={() => setShowForm(false)}
            onSuccess={fetchTestimonials}
          />
        )}
      </AnimatePresence>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-6 animate-pulse space-y-3">
              <div className="h-4 bg-secondary rounded w-1/3" />
              <div className="h-3 bg-secondary rounded w-full" />
              <div className="h-3 bg-secondary rounded w-5/6" />
              <div className="flex items-center gap-3 pt-3">
                <div className="w-10 h-10 rounded-full bg-secondary" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3 bg-secondary rounded w-1/2" />
                  <div className="h-2.5 bg-secondary rounded w-3/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.id || i}
              variants={card}
              whileHover={{ y: -6 }}
              transition={{ type: 'spring', stiffness: 300 }}
              className="relative bg-card border border-border rounded-2xl p-6 flex flex-col gap-4 shadow-sm hover:shadow-lg hover:border-blue-500/30 transition-all duration-300"
            >
              <Quote className="w-8 h-8 text-blue-600/20 absolute top-4 right-4" />

              {/* Stars */}
              <div className="flex gap-0.5">
                {Array.from({ length: t.rating || 5 }).map((_, s) => (
                  <Star key={s} className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                ))}
              </div>

              {/* Text */}
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">"{t.text}"</p>

              {/* Author */}
              <div className="flex items-center gap-3 pt-2 border-t border-border">
                {t.photo_url ? (
                  <img src={t.photo_url} alt={t.name}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-border" />
                ) : (
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getGradient(t.name)} flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}>
                    {getInitials(t.name)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-sm truncate">{t.name}</p>
                    {t.linkedin_url && (
                      <a href={t.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-400 flex-shrink-0">
                        <Linkedin className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{t.job_title} · {t.company}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.section>
  )
}
