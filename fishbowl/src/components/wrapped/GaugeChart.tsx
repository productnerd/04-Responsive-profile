import { motion } from 'framer-motion'

interface Props {
  value: number // 1-5
  label: string
  sublabel?: string
}

export default function GaugeChart({ value, label, sublabel }: Props) {
  const pct = (value / 5) * 100
  const circumference = 2 * Math.PI * 70 // r=70
  const strokeDash = (pct / 100) * circumference * 0.75 // 270 degree arc

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-48 h-48">
        <svg viewBox="0 0 160 160" className="w-full h-full -rotate-[135deg]">
          {/* Background arc */}
          <circle
            cx="80" cy="80" r="70"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          />
          {/* Value arc */}
          <motion.circle
            cx="80" cy="80" r="70"
            fill="none"
            stroke="url(#gaugeGrad)"
            strokeWidth="12"
            strokeLinecap="round"
            initial={{ strokeDasharray: `0 ${circumference}` }}
            animate={{ strokeDasharray: `${strokeDash} ${circumference - strokeDash}` }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
          />
          <defs>
            <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6C5CE7" />
              <stop offset="100%" stopColor="#FD79A8" />
            </linearGradient>
          </defs>
        </svg>
        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8 }}
            className="text-4xl font-bold"
          >
            {value}
          </motion.span>
          <span className="text-xs text-text-secondary">out of 5</span>
        </div>
      </div>
      <p className="text-lg font-semibold">{label}</p>
      {sublabel && <p className="text-sm text-text-secondary">{sublabel}</p>}
    </div>
  )
}
