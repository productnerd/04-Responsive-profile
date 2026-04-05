import { motion } from 'framer-motion'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function FreeText({ value, onChange, placeholder }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-lg"
    >
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Be honest — it\'s anonymous...'}
        rows={4}
        className="w-full px-5 py-4 rounded-2xl bg-white/5 border-2 border-white/10 text-text-primary placeholder-text-secondary text-base resize-none focus:outline-none focus:border-primary/50 focus:bg-white/8 transition-all duration-200"
      />
      <p className="mt-2 text-xs text-text-secondary text-right">
        1-2 sentences is perfect
      </p>
    </motion.div>
  )
}
