import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { getQuestionsForName } from '../data/questions'
import type { Question, Session } from '../types'
import MultipleChoice from '../components/questions/MultipleChoice'
import Rating from '../components/questions/Rating'
import FreeText from '../components/questions/FreeText'
import ProgressBar from '../components/ui/ProgressBar'
import Button from '../components/ui/Button'

const AUTO_ADVANCE_DELAY = 400

export default function Questionnaire() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<Session | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [current, setCurrent] = useState(0)
  const [maxReached, setMaxReached] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string | number>>({})
  const [hydrated, setHydrated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [direction, setDirection] = useState(1)
  const autoAdvanceTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const load = async () => {
      if (!slug) return

      if (isSupabaseConfigured()) {
        const { data } = await supabase
          .from('tte_sessions')
          .select('*')
          .eq('slug', slug)
          .single()
        if (data) {
          setSession(data)
          setQuestions(getQuestionsForName(data.creator_name))
        }
      } else {
        const sessions = JSON.parse(localStorage.getItem('tte_sessions') || '{}')
        const s = sessions[slug]
        if (s) {
          setSession(s)
          setQuestions(getQuestionsForName(s.creator_name))
        }
      }

      // Hydrate in-progress quiz state from localStorage
      try {
        const saved = localStorage.getItem(`tte_progress_${slug}`)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed && typeof parsed === 'object') {
            if (parsed.answers) setAnswers(parsed.answers)
            if (typeof parsed.current === 'number') setCurrent(parsed.current)
            if (typeof parsed.maxReached === 'number') setMaxReached(parsed.maxReached)
          }
        }
      } catch {
        // ignore corrupted storage
      }

      setHydrated(true)
      setLoading(false)
    }
    load()
  }, [slug])

  // Persist progress whenever answers/current/maxReached change
  useEffect(() => {
    if (!slug || !hydrated) return
    try {
      localStorage.setItem(
        `tte_progress_${slug}`,
        JSON.stringify({ answers, current, maxReached })
      )
    } catch {
      // ignore storage errors
    }
  }, [slug, hydrated, answers, current, maxReached])

  // Clear any pending auto-advance timer on unmount or question change
  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current !== null) {
        window.clearTimeout(autoAdvanceTimerRef.current)
      }
    }
  }, [])

  const alreadyResponded = slug ? localStorage.getItem(`tte_responded_${slug}`) === 'true' : false

  const q = questions[current]
  const isAnswered = q ? answers[q.id] !== undefined && answers[q.id] !== '' : false
  const isLast = current === questions.length - 1
  const isReviewing = current < maxReached // user navigated back
  // For MC with "Other" selected (free text), don't auto-advance; show Next button
  const isMcOtherEntry =
    !!q &&
    q.type === 'mc' &&
    !!q.allowOther &&
    answers[q.id] !== undefined &&
    !(q.options || []).includes(answers[q.id] as string)

  const handleNext = useCallback(() => {
    if (!isAnswered) return
    if (autoAdvanceTimerRef.current !== null) {
      window.clearTimeout(autoAdvanceTimerRef.current)
      autoAdvanceTimerRef.current = null
    }
    if (isLast) {
      handleSubmit()
    } else {
      setDirection(1)
      setCurrent((c) => {
        const next = c + 1
        setMaxReached((m) => Math.max(m, next))
        return next
      })
    }
  }, [isAnswered, isLast])

  const handleBack = () => {
    if (current > 0) {
      if (autoAdvanceTimerRef.current !== null) {
        window.clearTimeout(autoAdvanceTimerRef.current)
        autoAdvanceTimerRef.current = null
      }
      setDirection(-1)
      setCurrent((c) => c - 1)
    }
  }

  // Handles an MC/Rating selection with optional auto-advance
  const handleSelect = (value: string | number) => {
    if (!q) return
    setAnswers((a) => ({ ...a, [q.id]: value }))

    // Don't auto-advance if the user is typing into an "Other" field on an MC question
    const isTypingOther =
      q.type === 'mc' &&
      !!q.allowOther &&
      typeof value === 'string' &&
      !(q.options || []).includes(value)

    // Auto-advance only when on the frontier (not reviewing) and not last question
    if (!isReviewing && !isLast && !isTypingOther) {
      if (autoAdvanceTimerRef.current !== null) {
        window.clearTimeout(autoAdvanceTimerRef.current)
      }
      autoAdvanceTimerRef.current = window.setTimeout(() => {
        setDirection(1)
        setCurrent((c) => {
          const next = c + 1
          setMaxReached((m) => Math.max(m, next))
          return next
        })
        autoAdvanceTimerRef.current = null
      }, AUTO_ADVANCE_DELAY)
    }
  }

  const handleSubmit = async () => {
    if (!slug || !session) return
    setSubmitting(true)

    if (isSupabaseConfigured()) {
      const { error: dbError } = await supabase.from('tte_responses').insert({
        session_id: session.id,
        answers,
      })
      if (dbError) {
        setError('Failed to submit. Please try again.')
        setSubmitting(false)
        return
      }
    } else {
      const responses = JSON.parse(localStorage.getItem('tte_responses') || '{}')
      if (!responses[slug]) responses[slug] = []
      responses[slug].push({
        id: crypto.randomUUID(),
        session_id: session.id,
        answers,
        completed_at: new Date().toISOString(),
      })
      localStorage.setItem('tte_responses', JSON.stringify(responses))

      const sessions = JSON.parse(localStorage.getItem('tte_sessions') || '{}')
      if (sessions[slug]) {
        sessions[slug].response_count = (sessions[slug].response_count || 0) + 1
        localStorage.setItem('tte_sessions', JSON.stringify(sessions))
      }
    }

    localStorage.setItem(`tte_responded_${slug}`, 'true')
    localStorage.removeItem(`tte_progress_${slug}`)
    navigate(`/s/${slug}/done`)
  }

  if (loading) {
    return (
      <div className="card-screen">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="text-4xl">
          👁
        </motion.div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="card-screen text-center">
        <div className="text-5xl mb-4">😕</div>
        <h1 className="text-2xl font-bold mb-2">Link not found</h1>
        <p className="text-text-secondary">This link doesn't exist or has expired.</p>
      </div>
    )
  }

  if (alreadyResponded) {
    return (
      <div className="card-screen text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-bold mb-2">You've already responded!</h1>
        <p className="text-text-secondary">
          Thanks for helping {session.creator_name} see themselves through your eyes.
        </p>
      </div>
    )
  }

  if (!q) return null

  const prevQ = current > 0 ? questions[current - 1] : null
  const isNewSection = !prevQ || prevQ.section !== q.section

  // Show Next button only when: reviewing (went back) OR last question OR freetext OR MC with Other selected
  const showNextButton = isReviewing || isLast || q.type === 'freetext' || isMcOtherEntry

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -80 : 80, opacity: 0 }),
  }

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-surface/80 backdrop-blur-lg px-4 pt-4 pb-3">
        <ProgressBar current={current + 1} total={questions.length} />
      </div>

      {/* Question */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-32">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={q.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="flex flex-col items-center gap-6 w-full max-w-lg"
          >
            {isNewSection && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center mb-2"
              >
                <p className="text-xs uppercase tracking-widest text-primary-light font-semibold mb-1">
                  {q.section}
                </p>
                <p className="text-xs text-text-secondary">{q.sectionDescription}</p>
              </motion.div>
            )}

            <h2 className="text-xl md:text-2xl font-bold text-center leading-snug">
              {q.text}
            </h2>

            {q.type === 'mc' && q.options && (
              <MultipleChoice
                options={q.options}
                selected={(answers[q.id] as string | null) ?? null}
                onSelect={handleSelect}
                allowOther={q.allowOther}
              />
            )}
            {q.type === 'rating' && (
              <Rating
                value={(answers[q.id] as number | null) ?? null}
                onChange={handleSelect}
                lowLabel={q.lowLabel}
                highLabel={q.highLabel}
              />
            )}
            {q.type === 'freetext' && (
              <FreeText
                value={(answers[q.id] as string) || ''}
                onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-lg border-t border-white/5 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button
            onClick={handleBack}
            disabled={current === 0}
            className="text-sm text-text-secondary hover:text-text-primary disabled:opacity-30 cursor-pointer transition-colors"
          >
            ← Back
          </button>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          {showNextButton ? (
            <Button
              onClick={handleNext}
              disabled={!isAnswered || submitting}
              variant="primary"
              className="!px-6 !py-3 text-sm"
            >
              {submitting ? 'Submitting...' : isLast ? 'Submit' : 'Next →'}
            </Button>
          ) : (
            <div className="text-xs text-text-secondary italic">
              Tap an answer to continue
            </div>
          )}
        </div>
        <p className="max-w-lg mx-auto mt-3 text-center text-[10px] text-text-secondary/70 leading-relaxed">
          Everything you share is completely anonymous. {session.creator_name} will never know which answers are yours.
        </p>
      </div>
    </div>
  )
}
