import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import Button from '../components/ui/Button'

export default function Landing() {
  const navigate = useNavigate()
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    setHasSession(Boolean(localStorage.getItem('tte_my_session')))
  }, [])

  return (
    <div className="card-screen text-center relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-accent/8 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 max-w-lg">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="text-7xl"
        >
          👁
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-4xl md:text-5xl font-bold leading-tight"
        >
          See yourself
          <br />
          <span className="bg-gradient-to-r from-primary-light to-accent bg-clip-text text-transparent">
            through their eyes
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="text-lg text-text-secondary leading-relaxed max-w-md"
        >
          Share a link with friends. They answer 25 anonymous questions about you.
          After 6 people respond, you unlock a personalized reveal of how others truly see you.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col gap-4 items-center"
        >
          <Button onClick={() => navigate('/create')}>
            {hasSession ? 'View your link' : 'Create your link'}
          </Button>
          <p className="text-xs text-text-secondary">
            Free. Anonymous. No sign-up needed.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-8 flex flex-col gap-3 text-sm text-text-secondary"
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">🔒</span>
            <span>Results locked until 6 friends respond</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg">🕵️</span>
            <span>100% anonymous — no names, no tracking</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg">⏱</span>
            <span>Takes ~5 minutes to complete</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg">✨</span>
            <span>Results revealed in a Wrapped-style experience</span>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
