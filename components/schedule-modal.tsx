'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X, CalendarDays } from 'lucide-react'
import { MeetingBookingForm } from './meeting-booking-form'

interface ScheduleModalProps {
  defaultType?: 'meeting' | 'interview'
  trigger: React.ReactNode
}

function ModalContent({
  defaultType,
  onClose,
}: {
  defaultType: 'meeting' | 'interview'
  onClose: () => void
}) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Lock body scroll
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [])

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99998,
          background: 'rgba(0, 0, 0, 0.80)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      />

      {/* Modal panel wrapper (centers content) */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          pointerEvents: 'none',
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 24 }}
          transition={{ type: 'spring', stiffness: 340, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            pointerEvents: 'auto',
            width: '100%',
            maxWidth: '32rem',
            maxHeight: 'calc(100dvh - 2rem)',
            overflowY: 'auto',
            background: '#0f172a',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '1rem',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              background: '#0f172a',
              zIndex: 10,
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '1rem 1rem 0 0',
              flexShrink: 0,
            }}
            className="flex items-center justify-between px-6 py-4"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30">
                <CalendarDays className="w-4 h-4 text-blue-400" />
              </div>
              <h2 className="font-bold text-white text-base">
                Schedule {defaultType === 'interview' ? 'Interview / Meeting' : 'a Meeting'}
              </h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            <MeetingBookingForm defaultType={defaultType} onClose={onClose} />
          </div>
        </motion.div>
      </div>
    </>
  )
}

export function ScheduleModal({ defaultType = 'meeting', trigger }: ScheduleModalProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleOpen = useCallback(() => setOpen(true), [])
  const handleClose = useCallback(() => setOpen(false), [])

  return (
    <>
      {/* Render trigger inline — display:contents so it doesn't add a wrapper box */}
      <span onClick={handleOpen} style={{ display: 'contents' }}>
        {trigger}
      </span>

      {/* Portal: mounts directly on document.body, bypasses all overflow:hidden ancestors */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <ModalContent
                key="schedule-modal"
                defaultType={defaultType}
                onClose={handleClose}
              />
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  )
}
