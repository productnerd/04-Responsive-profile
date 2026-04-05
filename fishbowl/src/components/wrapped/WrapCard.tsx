import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  gradient?: string
  className?: string
  wide?: boolean
}

const gradients: Record<string, string> = {
  purple: 'from-[#2D1B69] via-[#1A1A2E] to-[#0F3460]',
  warm: 'from-[#4A1942] via-[#1A1A2E] to-[#16213E]',
  ocean: 'from-[#0D324D] via-[#1A1A2E] to-[#1B2838]',
  sunset: 'from-[#4A2C2A] via-[#1A1A2E] to-[#2D1B3D]',
  forest: 'from-[#1B4332] via-[#1A1A2E] to-[#0D324D]',
  midnight: 'from-[#1A1A2E] via-[#16213E] to-[#0F3460]',
  rose: 'from-[#3D1F3D] via-[#1A1A2E] to-[#2D1B3D]',
  golden: 'from-[#3D2E1F] via-[#1A1A2E] to-[#1B2838]',
}

export default function WrapCard({ children, gradient = 'purple', className = '', wide = false }: Props) {
  const bg = gradients[gradient] || gradients.purple
  const widthClass = wide ? 'max-w-lg md:max-w-4xl' : 'max-w-lg'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className={`min-h-dvh bg-gradient-to-b ${bg} relative overflow-hidden flex flex-col items-center justify-start pt-24 px-6 pb-10 ${className}`}
    >
      {/* Subtle decorative glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      <div className={`relative z-10 flex flex-col items-center gap-6 ${widthClass} w-full text-center`}>
        {children}
      </div>
    </motion.div>
  )
}
