import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { Session } from '../types'

export default function Done() {
  const { slug } = useParams<{ slug: string }>()
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    const load = async () => {
      if (!slug) return
      if (isSupabaseConfigured()) {
        const { data } = await supabase.from('tte_sessions').select('*').eq('slug', slug).single()
        if (data) setSession(data)
      } else {
        const sessions = JSON.parse(localStorage.getItem('tte_sessions') || '{}')
        if (sessions[slug]) setSession(sessions[slug])
      }
    }
    load()
  }, [slug])

  return (
    <div className="card-screen text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-6 max-w-lg"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="text-7xl"
        >
          🙏
        </motion.div>

        <h1 className="text-3xl font-bold">Thank you!</h1>

        <p className="text-lg text-text-secondary leading-relaxed">
          Your honest answers will help{' '}
          <span className="text-primary-light font-semibold">{session?.creator_name || '...'}</span>{' '}
          see themselves in a new light.
        </p>

        <p className="text-sm text-text-secondary mt-4">
          Everything you shared is completely anonymous.
          <br />
          {session?.creator_name} will never know which answers are yours.
        </p>
      </motion.div>
    </div>
  )
}
