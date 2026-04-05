import { motion } from 'framer-motion'

interface Props {
  current: number
  total: number
}

export default function ProgressBar({ current, total }: Props) {
  const pct = (current / total) * 100

  return (
    <div className="w-full max-w-lg">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-text-secondary font-medium">
          {current} of {total}
        </span>
        <span className="text-xs text-text-secondary">
          {Math.round(pct)}%
        </span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}
