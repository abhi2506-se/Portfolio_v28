'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, X, Play, ZoomIn, Image as ImageIcon, Film, FileImage } from 'lucide-react'

interface MediaItem {
  id: string
  project_id: string
  media_type: 'image' | 'gif' | 'video'
  media_url: string
  thumbnail_url?: string
  title: string
  description: string
  display_order: number
  uploaded_at: string
}

interface Props {
  projectId: string
}

export default function ProjectMediaShowcase({ projectId }: Props) {
  const [media, setMedia] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState(0)
  const [lightbox, setLightbox] = useState<MediaItem | null>(null)

  useEffect(() => {
    fetch(`/api/admin/project-media?projectId=${projectId}`)
      .then(r => r.json())
      .then(d => setMedia((d.media || []).sort((a: MediaItem, b: MediaItem) => a.display_order - b.display_order)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [projectId])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (lightbox) {
        if (e.key === 'Escape') setLightbox(null)
        if (e.key === 'ArrowLeft') prevLightbox()
        if (e.key === 'ArrowRight') nextLightbox()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })

  if (loading || media.length === 0) return null

  const prevSlide = () => setCurrent(c => (c - 1 + media.length) % media.length)
  const nextSlide = () => setCurrent(c => (c + 1) % media.length)

  const lightboxIdx = lightbox ? media.findIndex(m => m.id === lightbox.id) : -1
  const prevLightbox = () => {
    const idx = (lightboxIdx - 1 + media.length) % media.length
    setLightbox(media[idx])
  }
  const nextLightbox = () => {
    const idx = (lightboxIdx + 1) % media.length
    setLightbox(media[idx])
  }

  return (
    <section className="w-full">
      {/* Hero carousel */}
      <div className="relative rounded-2xl overflow-hidden bg-slate-900/60 border border-slate-800/60 group">
        {/* Main display */}
        <div className="relative aspect-video">
          <AnimatePresence mode="wait">
            <motion.div
              key={media[current]?.id}
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              className="absolute inset-0"
            >
              {media[current]?.media_type === 'video' ? (
                <video
                  src={media[current].media_url}
                  className="w-full h-full object-cover"
                  autoPlay muted loop playsInline
                  controlsList="nodownload"
                  onContextMenu={e => e.preventDefault()}
                />
              ) : (
                <img
                  src={media[current]?.media_url}
                  alt={media[current]?.title || 'Project media'}
                  className="w-full h-full object-cover select-none"
                  onContextMenu={e => e.preventDefault()}
                  draggable={false}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />

          {/* Navigation arrows */}
          {media.length > 1 && (
            <>
              <button
                onClick={prevSlide}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 border border-white/10 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={nextSlide}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 border border-white/10 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Expand button */}
          <button
            onClick={() => setLightbox(media[current])}
            className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-black/50 hover:bg-black/70 border border-white/10 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {/* Caption */}
          {(media[current]?.title || media[current]?.description) && (
            <div className="absolute bottom-0 left-0 right-0 p-4">
              {media[current].title && (
                <p className="text-white font-semibold text-sm">{media[current].title}</p>
              )}
              {media[current].description && (
                <p className="text-white/70 text-xs mt-0.5">{media[current].description}</p>
              )}
            </div>
          )}

          {/* Dot indicator */}
          {media.length > 1 && (
            <div className="absolute bottom-3 right-4 flex gap-1.5">
              {media.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`rounded-full transition-all ${i === current ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/70'}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Thumbnail strip */}
        {media.length > 1 && (
          <div className="flex gap-2 p-3 overflow-x-auto scrollbar-hide">
            {media.map((item, idx) => (
              <motion.button
                key={item.id}
                onClick={() => setCurrent(idx)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                  idx === current ? 'border-blue-500 opacity-100' : 'border-transparent opacity-50 hover:opacity-80'
                }`}
              >
                {item.media_type === 'video' ? (
                  <div className="w-full h-full flex items-center justify-center bg-slate-800">
                    <Play className="w-4 h-4 text-orange-400" />
                  </div>
                ) : (
                  <img
                    src={item.thumbnail_url || item.media_url}
                    alt={item.title}
                    className="w-full h-full object-cover select-none"
                    draggable={false}
                    onContextMenu={e => e.preventDefault()}
                  />
                )}
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4"
            onClick={() => setLightbox(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 20 }}
              className="relative max-w-5xl w-full max-h-[90vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Lightbox header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  {lightbox.title && <p className="text-white font-semibold">{lightbox.title}</p>}
                  {lightbox.description && <p className="text-white/60 text-sm">{lightbox.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {media.length > 1 && (
                    <span className="text-white/40 text-sm">{lightboxIdx + 1} / {media.length}</span>
                  )}
                  <button onClick={() => setLightbox(null)} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Lightbox media */}
              <div className="relative flex-1 min-h-0 rounded-2xl overflow-hidden bg-slate-900">
                {lightbox.media_type === 'video' ? (
                  <video
                    src={lightbox.media_url}
                    controls
                    className="w-full h-full max-h-[75vh] object-contain"
                    controlsList="nodownload"
                    onContextMenu={e => e.preventDefault()}
                  />
                ) : (
                  <img
                    src={lightbox.media_url}
                    alt={lightbox.title}
                    className="w-full h-full max-h-[75vh] object-contain select-none"
                    onContextMenu={e => e.preventDefault()}
                    draggable={false}
                  />
                )}
              </div>

              {/* Navigation */}
              {media.length > 1 && (
                <>
                  <button
                    onClick={e => { e.stopPropagation(); prevLightbox() }}
                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); nextLightbox() }}
                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
