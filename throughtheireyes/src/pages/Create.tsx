import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import Button from '../components/ui/Button'

const MY_SESSION_KEY = 'tte_my_session'
const REQUIRED_RESPONSES = 5

function generateSlug(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789'
  let slug = ''
  for (let i = 0; i < 8; i++) {
    slug += chars[Math.floor(Math.random() * chars.length)]
  }
  return slug
}

function getShareLink(slug: string): string {
  const base = window.location.origin + window.location.pathname
  return `${base}#/s/${slug}`
}

export default function Create() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [slug, setSlug] = useState<string | null>(null)
  const [creatorName, setCreatorName] = useState('')
  const [responseCount, setResponseCount] = useState(0)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [checkingExisting, setCheckingExisting] = useState(true)

  // On mount: check if user already has a session
  useEffect(() => {
    const stored = localStorage.getItem(MY_SESSION_KEY)
    if (!stored) {
      setCheckingExisting(false)
      return
    }
    try {
      const { slug: storedSlug, creator_name } = JSON.parse(stored)
      setSlug(storedSlug)
      setCreatorName(creator_name)
    } catch {
      localStorage.removeItem(MY_SESSION_KEY)
    }
    setCheckingExisting(false)
  }, [])

  // Fetch latest response count whenever we have a slug
  useEffect(() => {
    if (!slug) return
    const fetchCount = async () => {
      if (isSupabaseConfigured()) {
        const { data } = await supabase
          .from('tte_sessions')
          .select('response_count')
          .eq('slug', slug)
          .single()
        if (data) setResponseCount(data.response_count || 0)
      } else {
        const sessions = JSON.parse(localStorage.getItem('tte_sessions') || '{}')
        if (sessions[slug]) setResponseCount(sessions[slug].response_count || 0)
      }
    }
    fetchCount()
  }, [slug])

  const handleCreate = async () => {
    if (!name.trim()) return
    setLoading(true)
    setError('')

    const newSlug = generateSlug()
    const trimmedName = name.trim()

    if (isSupabaseConfigured()) {
      const { error: dbError } = await supabase.from('tte_sessions').insert({
        creator_name: trimmedName,
        slug: newSlug,
        response_count: 0,
      })
      if (dbError) {
        setError('Something went wrong. Please try again.')
        setLoading(false)
        return
      }
    } else {
      const sessions = JSON.parse(localStorage.getItem('tte_sessions') || '{}')
      sessions[newSlug] = {
        id: crypto.randomUUID(),
        creator_name: trimmedName,
        slug: newSlug,
        created_at: new Date().toISOString(),
        response_count: 0,
      }
      localStorage.setItem('tte_sessions', JSON.stringify(sessions))
    }

    // Persist "my session" so the user comes back here next time
    localStorage.setItem(
      MY_SESSION_KEY,
      JSON.stringify({ slug: newSlug, creator_name: trimmedName })
    )

    setSlug(newSlug)
    setCreatorName(trimmedName)
    setLoading(false)
  }

  const handleCopy = async () => {
    if (!slug) return
    await navigator.clipboard.writeText(getShareLink(slug))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleStartOver = () => {
    if (!confirm('Start over with a new name? Your current link and responses will still exist, but this browser will forget about them.')) return
    localStorage.removeItem(MY_SESSION_KEY)
    setSlug(null)
    setCreatorName('')
    setName('')
    setResponseCount(0)
  }

  if (checkingExisting) {
    return (
      <div className="card-screen">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="text-4xl">
          👁
        </motion.div>
      </div>
    )
  }

  // Share / status screen
  if (slug) {
    const shareLink = getShareLink(slug)
    const remaining = Math.max(0, REQUIRED_RESPONSES - responseCount)
    const unlocked = responseCount >= REQUIRED_RESPONSES
    const progressPct = Math.min(100, (responseCount / REQUIRED_RESPONSES) * 100)

    return (
      <div className="card-screen text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6 max-w-lg w-full"
        >
          <div className="text-6xl">🔗</div>
          <h1 className="text-3xl font-bold">
            Hey {creatorName}!
          </h1>
          <p className="text-text-secondary">
            Share this link with at least 6 friends. Once they all answer, your results will unlock.
          </p>

          <div className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-3">
            <input
              readOnly
              value={shareLink}
              className="flex-1 bg-transparent text-sm text-text-primary truncate outline-none"
            />
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-primary rounded-xl text-sm font-medium text-white shrink-0 cursor-pointer hover:bg-primary-dark transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* Progress */}
          <div className="w-full bg-white/5 rounded-2xl p-5 border border-white/10">
            <div className="flex justify-between text-sm mb-3">
              <span className="text-text-secondary">Responses</span>
              <span className="text-primary-light font-semibold">
                {responseCount} / {REQUIRED_RESPONSES}
              </span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
              />
            </div>
            <p className="mt-3 text-sm">
              {unlocked ? (
                <span className="text-success font-semibold">✨ Your results are ready!</span>
              ) : (
                <span className="text-text-secondary">
                  <span className="text-primary-light font-bold">{remaining}</span> more{' '}
                  {remaining === 1 ? 'response' : 'responses'} to unlock your report
                </span>
              )}
            </p>
          </div>

          {unlocked && (
            <Button onClick={() => navigate(`/results/${slug}`)}>
              See your results →
            </Button>
          )}

          <button
            onClick={handleStartOver}
            className="text-xs text-text-secondary hover:text-text-primary cursor-pointer transition-colors mt-2"
          >
            Start over with a new name
          </button>
        </motion.div>
      </div>
    )
  }

  // Name entry screen
  return (
    <div className="card-screen text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-6 max-w-lg w-full"
      >
        <div className="text-5xl">✏️</div>
        <h1 className="text-3xl font-bold">What's your first name?</h1>
        <p className="text-text-secondary">
          This is how your friends will see you in the questions.
          <br />
          e.g. "What is <span className="text-primary-light">Alex</span>'s superpower?"
        </p>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="Your first name"
          autoFocus
          maxLength={30}
          className="w-full max-w-sm px-6 py-4 rounded-2xl bg-white/5 border-2 border-white/10 text-center text-xl font-medium text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary/50 transition-all"
        />

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <Button onClick={handleCreate} disabled={!name.trim() || loading}>
          {loading ? 'Creating...' : 'Create my link'}
        </Button>
      </motion.div>
    </div>
  )
}
