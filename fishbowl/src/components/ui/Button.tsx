import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost'
  disabled?: boolean
  className?: string
  type?: 'button' | 'submit'
}

export default function Button({ children, onClick, variant = 'primary', disabled, className = '', type = 'button' }: Props) {
  const base = 'px-8 py-4 rounded-2xl font-semibold text-base transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-primary text-white hover:bg-primary-dark shadow-lg shadow-primary/25 hover:shadow-primary/40',
    secondary: 'bg-white/10 text-text-primary border-2 border-white/20 hover:bg-white/15',
    ghost: 'bg-transparent text-text-secondary hover:text-text-primary',
  }

  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      type={type}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {children}
    </motion.button>
  )
}
