import { motion } from 'framer-motion'

interface Props {
  value: number | null
  onChange: (value: number) => void
  lowLabel?: string
  highLabel?: string
}

export default function Rating({ value, onChange, lowLabel = 'Not at all', highLabel = 'Absolutely' }: Props) {
  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg">
      <div className="flex gap-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <motion.button
            key={n}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: n * 0.05 }}
            onClick={() => onChange(n)}
            className={`w-14 h-14 rounded-2xl text-xl font-bold transition-all duration-200 border-2 cursor-pointer ${
              value === n
                ? 'bg-primary text-white border-primary shadow-lg shadow-primary/30 scale-110'
                : 'bg-white/5 border-white/10 text-text-primary hover:bg-white/10 hover:border-white/20'
            }`}
          >
            {n}
          </motion.button>
        ))}
      </div>
      <div className="flex justify-between w-full max-w-[310px] text-xs text-text-secondary">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  )
}
