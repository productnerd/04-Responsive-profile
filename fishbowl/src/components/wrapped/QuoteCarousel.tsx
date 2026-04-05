import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  quotes: string[]
  emptyMessage?: string
}

export default function QuoteCarousel({ quotes, emptyMessage = 'No responses yet' }: Props) {
  const [idx, setIdx] = useState(0)

  if (quotes.length === 0) {
    return <p className="text-text-secondary italic">{emptyMessage}</p>
  }

  return (
    <div className="w-full max-w-md flex flex-col items-center gap-4">
      <div className="min-h-[120px] flex items-center">
        <AnimatePresence mode="wait">
          <motion.blockquote
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="text-lg md:text-xl font-medium leading-relaxed text-center px-4 italic text-primary-light"
          >
            "{quotes[idx]}"
          </motion.blockquote>
        </AnimatePresence>
      </div>

      {quotes.length > 1 && (
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIdx((i) => (i > 0 ? i - 1 : quotes.length - 1))}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/15 transition-colors cursor-pointer"
          >
            ←
          </button>
          <span className="text-xs text-text-secondary">
            {idx + 1} / {quotes.length}
          </span>
          <button
            onClick={() => setIdx((i) => (i < quotes.length - 1 ? i + 1 : 0))}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/15 transition-colors cursor-pointer"
          >
            →
          </button>
        </div>
      )}
    </div>
  )
}
