import { motion } from 'framer-motion'

interface BarItem {
  label: string
  value: number
  maxValue?: number
}

interface Props {
  items: BarItem[]
  color?: string
}

export default function BarChart({ items, color = 'bg-primary' }: Props) {
  const max = Math.max(...items.map((i) => i.maxValue || i.value), 1)

  return (
    <div className="flex flex-col gap-3 w-full">
      {items.map((item, i) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-xs text-text-secondary w-28 text-right shrink-0 leading-tight break-words">
            {item.label}
          </span>
          <div className="flex-1 h-8 bg-white/5 rounded-full overflow-hidden relative">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(item.value / max) * 100}%` }}
              transition={{ delay: i * 0.1, duration: 0.6, ease: 'easeOut' }}
              className={`h-full ${color} rounded-full flex items-center justify-end pr-2`}
            >
              <span className="text-xs font-bold text-white">
                {item.value}%
              </span>
            </motion.div>
          </div>
        </div>
      ))}
    </div>
  )
}
