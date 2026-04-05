import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { aggregateResponses, topMcAnswers } from '../lib/aggregation'
import { useAiInsights, type AreaKey } from '../lib/aiInsights'
import type { Session, AggregatedResults } from '../types'
import WrapCard from '../components/wrapped/WrapCard'
import BarChart from '../components/wrapped/BarChart'
import GaugeChart from '../components/wrapped/GaugeChart'
import QuoteCarousel from '../components/wrapped/QuoteCarousel'
import ProgressDots from '../components/wrapped/ProgressDots'
import RichText from '../components/wrapped/RichText'

const REQUIRED_RESPONSES = 5

export default function Results() {
  const { slug } = useParams<{ slug: string }>()
  const [session, setSession] = useState<Session | null>(null)
  const [data, setData] = useState<AggregatedResults | null>(null)
  const [loading, setLoading] = useState(true)
  const [cardIndex, setCardIndex] = useState(0)

  useEffect(() => {
    const load = async () => {
      if (!slug) return

      if (isSupabaseConfigured()) {
        const { data: sessionData } = await supabase
          .from('tte_sessions').select('*').eq('slug', slug).single()
        if (!sessionData) { setLoading(false); return }
        setSession(sessionData)

        if (sessionData.response_count >= REQUIRED_RESPONSES) {
          const { data: responses } = await supabase
            .from('tte_responses').select('answers').eq('session_id', sessionData.id)
          if (responses) {
            setData(aggregateResponses(responses, sessionData.creator_name))
          }
        }
      } else {
        const sessions = JSON.parse(localStorage.getItem('tte_sessions') || '{}')
        const s = sessions[slug]
        if (!s) { setLoading(false); return }
        setSession(s)

        const responses = JSON.parse(localStorage.getItem('tte_responses') || '{}')
        const resps = responses[slug] || []
        if (resps.length >= REQUIRED_RESPONSES) {
          setData(aggregateResponses(resps, s.creator_name))
        }
      }
      setLoading(false)
    }
    load()
  }, [slug])

  const {
    insights,
    regenerating,
    isStale,
    regenerate,
    cachedAt,
  } = useAiInsights(session?.id, session?.response_count, Boolean(data))

  // Dynamic card count: 1 opening + 25 details, plus 1 advice grid card when insights are ready
  const totalCards = 1 + 25 + (insights ? 1 : 0)
  const next = useCallback(() => setCardIndex((i) => Math.min(i + 1, totalCards - 1)), [totalCards])
  const prev = useCallback(() => setCardIndex((i) => Math.max(i - 1, 0)), [])

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next() }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [next, prev])

  // Touch swipe
  useEffect(() => {
    let startX = 0
    const handleStart = (e: TouchEvent) => { startX = e.touches[0].clientX }
    const handleEnd = (e: TouchEvent) => {
      const diff = startX - e.changedTouches[0].clientX
      if (Math.abs(diff) > 50) {
        if (diff > 0) next()
        else prev()
      }
    }
    window.addEventListener('touchstart', handleStart)
    window.addEventListener('touchend', handleEnd)
    return () => {
      window.removeEventListener('touchstart', handleStart)
      window.removeEventListener('touchend', handleEnd)
    }
  }, [next, prev])

  if (loading) {
    return (
      <div className="card-screen">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="text-4xl">🐠</motion.div>
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

  // Locked state
  if (!data) {
    const remaining = Math.max(0, REQUIRED_RESPONSES - (session.response_count || 0))
    const shareLink = `${window.location.origin}${window.location.pathname}#/s/${slug}`

    return (
      <div className="card-screen text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6 max-w-lg"
        >
          <div className="text-7xl">🔒</div>
          <h1 className="text-3xl font-bold">Results are locked</h1>
          <p className="text-lg text-text-secondary">
            You need <span className="text-primary-light font-bold">{remaining} more</span>{' '}
            {remaining === 1 ? 'response' : 'responses'} to unlock your reveal.
          </p>

          <div className="w-full bg-white/5 rounded-2xl p-6 border border-white/10">
            <div className="flex justify-between text-sm mb-3">
              <span className="text-text-secondary">Progress</span>
              <span className="text-primary-light font-semibold">
                {session.response_count || 0} / {REQUIRED_RESPONSES}
              </span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${((session.response_count || 0) / REQUIRED_RESPONSES) * 100}%` }}
                transition={{ duration: 0.8 }}
                className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
              />
            </div>
          </div>

          <p className="text-sm text-text-secondary">Share your link to get more responses:</p>
          <div className="w-full p-3 bg-white/5 rounded-xl border border-white/10 flex items-center gap-2">
            <input readOnly value={shareLink} className="flex-1 bg-transparent text-xs text-text-primary truncate outline-none" />
            <button
              onClick={() => navigator.clipboard.writeText(shareLink)}
              className="px-3 py-1.5 bg-primary rounded-lg text-xs font-medium text-white cursor-pointer hover:bg-primary-dark transition-colors"
            >
              Copy
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  // ─── THE REVEAL ───
  // No landing gate. Land directly on the AI opening card.

  // Helper functions
  const mc = (id: number) => data.mcResults[id]
  const rating = (id: number) => data.ratingResults[id]
  const freetext = (id: number) => data.freetextResults[id] || []
  const topAnswers = (id: number, n = 4) => topMcAnswers(mc(id), n)

  // MC options are phrased in third person during the quiz ("That they were serious").
  // When shown back to the creator, swap pronouns to second person.
  const toSecondPerson = (s: string): string =>
    s
      .replace(/\bthey're\b/gi, (m) => (m[0] === 'T' ? "You're" : "you're"))
      .replace(/\bthey\b/gi, (m) => (m[0] === 'T' ? 'You' : 'you'))
      .replace(/\btheir\b/gi, (m) => (m[0] === 'T' ? 'Your' : 'your'))
      .replace(/\bthemselves\b/gi, 'yourself')
  const topAnswersYou = (id: number, n = 4) =>
    topAnswers(id, n).map((a) => ({ ...a, option: toSecondPerson(a.option) }))

  const Kicker = ({ children }: { children: React.ReactNode }) => (
    <p className="text-xs uppercase tracking-widest text-accent font-semibold">{children}</p>
  )
  const Title = ({ children }: { children: React.ReactNode }) => (
    <h2 className="text-2xl md:text-3xl font-bold leading-tight">{children}</h2>
  )

  const AREA_LABELS: Record<AreaKey, string> = {
    first_impressions: 'First Impressions',
    talents: 'Talents & Superpowers',
    communication: 'Communication & Listening',
    emotional_depth: 'Emotional Depth',
    reliability: 'Reliability & Trust',
    blind_spots: 'Blind Spots & Growth',
    in_the_group: 'In the Group',
    what_they_love: 'What They Love About You',
  }
  const detailCards: Array<{ gradient: string; content: React.ReactNode; wide?: boolean }> = [
    // 1. First Impressions — the vibe
    {
      gradient: 'warm',
      content: (
        <>
          <Kicker>First Impressions</Kicker>
          <Title>The vibe you give off in the first 5 minutes</Title>
          <BarChart items={topAnswers(2).map(a => ({ label: a.option, value: a.pct }))} />
        </>
      ),
    },
    // 2. First Impressions — wrong assumption
    {
      gradient: 'warm',
      content: (
        <>
          <Kicker>First Impressions</Kicker>
          <Title>What they wrongly assumed about you at first</Title>
          <div className="w-full bg-white/5 rounded-2xl p-6 border border-white/10">
            <motion.p
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="text-3xl font-black text-primary-light"
            >
              {toSecondPerson(mc(1)?.winner || '')}
            </motion.p>
          </div>
          <BarChart items={topAnswersYou(1).map(a => ({ label: a.option, value: a.pct }))} />
        </>
      ),
    },
    // 3. The Shift — freetext
    {
      gradient: 'ocean',
      content: (
        <>
          <Kicker>The Shift</Kicker>
          <Title>First impressions that changed once they knew you</Title>
          <QuoteCarousel quotes={freetext(3)} emptyMessage="No stories shared yet" />
        </>
      ),
    },
    // 4. Your Superpower
    {
      gradient: 'purple',
      content: (
        <>
          <Kicker>Your Superpower</Kicker>
          <Title>Your most underrated skill</Title>
          <div className="w-full bg-white/5 rounded-2xl p-6 border border-white/10">
            <motion.p
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 150 }}
              className="text-4xl md:text-5xl font-black bg-gradient-to-r from-primary-light to-accent bg-clip-text text-transparent"
            >
              {mc(4)?.winner}
            </motion.p>
          </div>
          <BarChart items={topAnswers(4).map(a => ({ label: a.option, value: a.pct }))} />
        </>
      ),
    },
    // 5. Hidden Talent — freetext
    {
      gradient: 'forest',
      content: (
        <>
          <Kicker>Hidden Talent</Kicker>
          <Title>What you're great at and don't even notice</Title>
          <QuoteCarousel quotes={freetext(5)} emptyMessage="No talents noted yet" />
        </>
      ),
    },
    // 6. Trust in your judgment
    {
      gradient: 'ocean',
      content: (
        <>
          <Kicker>Trust</Kicker>
          <Title>How much people trust your judgment when it matters</Title>
          <GaugeChart value={rating(6)?.average || 0} label="Trust in your judgment" sublabel="Average rating out of 5" />
        </>
      ),
    },
    // 7. How well you listen
    {
      gradient: 'ocean',
      content: (
        <>
          <Kicker>Listening</Kicker>
          <Title>How well you actually listen</Title>
          <GaugeChart value={rating(7)?.average || 0} label="You, really listening" sublabel="Vs. waiting for your turn to talk" />
        </>
      ),
    },
    // 8. Safe to confide in
    {
      gradient: 'ocean',
      content: (
        <>
          <Kicker>Safety</Kicker>
          <Title>How comfortable people feel telling you something hard</Title>
          <GaugeChart value={rating(8)?.average || 0} label="Safe to be honest with" sublabel="When the conversation gets real" />
        </>
      ),
    },
    // 9. In a disagreement
    {
      gradient: 'sunset',
      content: (
        <>
          <Kicker>In a Disagreement</Kicker>
          <Title>What you tend to do when things get tense</Title>
          <div className="w-full bg-white/5 rounded-2xl p-6 border border-white/10">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-bold text-primary-light"
            >
              {mc(9)?.winner}
            </motion.p>
          </div>
          <BarChart items={topAnswers(9).map(a => ({ label: a.option, value: a.pct }))} />
        </>
      ),
    },
    // 10. Feel heard
    {
      gradient: 'rose',
      content: (
        <>
          <Kicker>In Conversation</Kicker>
          <Title>What you do that makes people feel really heard — or really unheard</Title>
          <QuoteCarousel quotes={freetext(10)} emptyMessage="No notes on your conversation style" />
        </>
      ),
    },
    // 11. When times are hard
    {
      gradient: 'sunset',
      content: (
        <>
          <Kicker>When Times Are Hard</Kicker>
          <Title>The kind of friend you are when people are struggling</Title>
          <div className="w-full bg-white/5 rounded-2xl p-6 border border-white/10">
            <motion.p
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="text-2xl font-bold text-primary-light"
            >
              {mc(11)?.winner}
            </motion.p>
          </div>
          <BarChart items={topAnswers(11).map(a => ({ label: a.option, value: a.pct }))} />
        </>
      ),
    },
    // 12. Emotion you hide
    {
      gradient: 'sunset',
      content: (
        <>
          <Kicker>What You Hold Back</Kicker>
          <Title>The emotion you struggle most to express</Title>
          <div className="w-full bg-white/5 rounded-2xl p-6 border border-white/10">
            <motion.p
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="text-5xl font-black text-accent"
            >
              {mc(12)?.winner}
            </motion.p>
          </div>
          <BarChart items={topAnswers(12).map(a => ({ label: a.option, value: a.pct }))} />
        </>
      ),
    },
    // 13. Reading the room
    {
      gradient: 'rose',
      content: (
        <>
          <Kicker>Reading the Room</Kicker>
          <Title>How well you pick up on how people feel</Title>
          <GaugeChart value={rating(13)?.average || 0} label="Room-reading" sublabel="Emotional attunement" />
        </>
      ),
    },
    // 14. Consistency
    {
      gradient: 'midnight',
      content: (
        <>
          <Kicker>Consistency</Kicker>
          <Title>How rock-solid you are, day to day</Title>
          <GaugeChart value={rating(14)?.average || 0} label="How consistent you are" sublabel="Hot and cold → Rock solid" />
        </>
      ),
    },
    // 15. Where you let people down
    {
      gradient: 'midnight',
      content: (
        <>
          <Kicker>Where You Slip</Kicker>
          <Title>Where you sometimes let people down</Title>
          <BarChart items={topAnswers(15).map(a => ({ label: a.option, value: a.pct }))} />
        </>
      ),
    },
    // 16. Biggest blind spot (no duplicate big text)
    {
      gradient: 'midnight',
      content: (
        <>
          <Kicker>Your Biggest Blind Spot</Kicker>
          <Title>The thing you can't see about yourself</Title>
          <BarChart items={topAnswersYou(16).map(a => ({ label: a.option, value: a.pct }))} />
        </>
      ),
    },
    // 17. Patterns they see
    {
      gradient: 'forest',
      content: (
        <>
          <Kicker>Patterns You Don't See</Kicker>
          <Title>What they notice that you might miss</Title>
          <QuoteCarousel quotes={freetext(18)} emptyMessage="No patterns shared" />
        </>
      ),
    },
    // 18. Growth area
    {
      gradient: 'forest',
      content: (
        <>
          <Kicker>The Growth Edge</Kicker>
          <Title>Where your friends want to see you level up</Title>
          <div className="w-full bg-white/5 rounded-2xl p-6 border border-white/10">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-bold text-primary-light"
            >
              {mc(17)?.winner}
            </motion.p>
          </div>
          <BarChart items={topAnswers(17).map(a => ({ label: a.option, value: a.pct }))} />
        </>
      ),
    },
    // 19. Hard truth with love
    {
      gradient: 'warm',
      content: (
        <>
          <Kicker>Hard Truth, With Love</Kicker>
          <Title>What they'd tell you, from a place of love</Title>
          <QuoteCarousel quotes={freetext(19)} emptyMessage="No hard truths yet" />
        </>
      ),
    },
    // 20. Your group role
    {
      gradient: 'purple',
      content: (
        <>
          <Kicker>Your Role in the Group</Kicker>
          <Title>What you naturally become in a friend group</Title>
          <div className="w-full bg-white/5 rounded-2xl p-6 border border-white/10">
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-4xl font-black bg-gradient-to-r from-primary-light to-accent bg-clip-text text-transparent"
            >
              {mc(20)?.winner}
            </motion.p>
          </div>
          <BarChart items={topAnswers(20).map(a => ({ label: a.option, value: a.pct }))} />
        </>
      ),
    },
    // 21. What group would lose
    {
      gradient: 'purple',
      content: (
        <>
          <Kicker>If You Left</Kicker>
          <Title>What the group would lose without you</Title>
          <div className="w-full bg-white/5 rounded-2xl p-6 border border-white/10">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-3xl font-black text-primary-light"
            >
              {mc(21)?.winner}
            </motion.p>
          </div>
          <BarChart items={topAnswers(21).map(a => ({ label: a.option, value: a.pct }))} />
        </>
      ),
    },
    // 22. Annoying habit
    {
      gradient: 'sunset',
      content: (
        <>
          <Kicker>The Annoying Truth 😅</Kicker>
          <Title>Your most annoying habit</Title>
          <div className="w-full bg-white/5 rounded-2xl p-6 border border-white/10">
            <motion.p
              initial={{ opacity: 0, rotate: -5 }}
              animate={{ opacity: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="text-2xl font-bold text-accent"
            >
              {mc(22)?.winner}
            </motion.p>
          </div>
          <BarChart items={topAnswers(22).map(a => ({ label: a.option, value: a.pct }))} />
        </>
      ),
    },
    // 23. What they appreciate
    {
      gradient: 'golden',
      content: (
        <>
          <Kicker>The Good Stuff ❤️</Kicker>
          <Title>What they genuinely appreciate about you</Title>
          <QuoteCarousel quotes={freetext(23)} />
        </>
      ),
    },
    // 24. Irreplaceable
    {
      gradient: 'golden',
      content: (
        <>
          <Kicker>One of a Kind</Kicker>
          <Title>What makes you irreplaceable</Title>
          <QuoteCarousel quotes={freetext(24)} />
        </>
      ),
    },
    // 25. Final message
    {
      gradient: 'rose',
      content: (
        <>
          <Kicker>The Final Message</Kicker>
          <Title>"If you only read one thing…"</Title>
          <QuoteCarousel quotes={freetext(25)} />
        </>
      ),
    },
  ]

  // Build opening summary card from AI insights (first card after "Show me")
  // Advice is a single card at the very end (index = 1 opening + 25 details = 26)
  const adviceStartIndex = 1 + detailCards.length
  const openingCard: { gradient: string; content: React.ReactNode; wide?: boolean } = {
    gradient: 'midnight',
    wide: true,
    content: (
      <>
        <Kicker>The Big Picture</Kicker>
        {insights ? (
          <>
            <Title><RichText text={insights.openingSummary.headline} /></Title>

            {isStale && cachedAt !== null && (
              <div className="w-full bg-accent/10 border border-accent/30 rounded-2xl p-4 text-left flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex-1 text-sm">
                  <p className="font-semibold text-text-primary mb-0.5">
                    New answers have come in since this was written.
                  </p>
                  <p className="text-text-secondary">
                    This report is based on {cachedAt} responses. You now have{' '}
                    {session.response_count}. Refresh to fold in the new perspectives.
                  </p>
                </div>
                <button
                  onClick={regenerate}
                  disabled={regenerating}
                  className="shrink-0 px-4 py-2 rounded-full bg-accent hover:bg-accent/90 disabled:opacity-60 text-white text-sm font-semibold cursor-pointer transition-all"
                >
                  {regenerating ? 'Refreshing…' : 'Regenerate'}
                </button>
              </div>
            )}

            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3">
              {insights.openingSummary.sections.map((s) => (
                <div
                  key={s.area}
                  className="bg-white/5 rounded-2xl p-4 border border-white/10 text-left h-full"
                >
                  <p className="text-[10px] uppercase tracking-widest text-accent font-semibold mb-1">
                    {AREA_LABELS[s.area]}
                  </p>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    <RichText text={s.insight} />
                  </p>
                </div>
              ))}
            </div>
            <button
              onClick={() => setCardIndex(adviceStartIndex)}
              className="mt-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-text-primary text-sm font-medium cursor-pointer transition-all"
            >
              Skip to advice ↓
            </button>
          </>
        ) : (
          <>
            <Title>Your report is being prepared.</Title>
            <div className="w-full bg-white/5 rounded-2xl p-6 border border-white/10 text-left">
              <p className="text-text-secondary text-sm leading-relaxed">
                We generate your AI report in the background the moment the 5th response lands,
                so by the time you visit it is already here. If you are seeing this message, the
                report is still being written. Refresh in a minute and it will be waiting.
              </p>
            </div>
            <p className="text-text-secondary text-sm">
              In the meantime, you can still swipe through what {data.totalResponses} people said about you.
            </p>
          </>
        )}
      </>
    ),
  }

  // Single wide advice card (all 8 areas in a grid, mirrors the opening card)
  const adviceCards: Array<{ gradient: string; content: React.ReactNode; wide?: boolean }> = insights
    ? [
        {
          gradient: 'forest',
          wide: true,
          content: (
            <>
              <Kicker>What To Do With This</Kicker>
              <Title>8 small things you could actually try</Title>
              <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3">
                {insights.advice.map((a) => {
                  const bullets: string[] = Array.isArray(a.action) ? a.action : [a.action]
                  return (
                    <div
                      key={a.area}
                      className="bg-white/5 rounded-2xl p-4 border border-white/10 text-left h-full"
                    >
                      <p className="text-[10px] uppercase tracking-widest text-accent font-semibold mb-2">
                        {AREA_LABELS[a.area]}
                      </p>
                      <ul className="flex flex-col gap-2 text-sm text-text-secondary leading-snug">
                        {bullets.map((b, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-accent shrink-0">•</span>
                            <span>
                              <RichText text={b} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            </>
          ),
        },
      ]
    : []

  const cards = [openingCard, ...detailCards, ...adviceCards]

  return (
    <>
      <ProgressDots total={cards.length} current={cardIndex} onNavigate={setCardIndex} />

      <AnimatePresence mode="wait">
        <WrapCard key={cardIndex} gradient={cards[cardIndex].gradient} wide={cards[cardIndex].wide}>
          {cards[cardIndex].content}

          {/* Inline nav rendered inside every card so it's always visible */}
          <div className="mt-8 flex items-center justify-center gap-4 w-full">
            <button
              onClick={prev}
              disabled={cardIndex === 0}
              className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-text-primary text-xl flex items-center justify-center hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
              aria-label="Previous card"
            >
              ←
            </button>
            <span className="text-xs text-text-secondary tabular-nums bg-white/5 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5">
              {cardIndex + 1} / {cards.length}
            </span>
            {cardIndex === cards.length - 1 ? (
              <button
                disabled
                className="h-12 px-5 rounded-full bg-white/10 border border-white/15 text-text-secondary text-sm flex items-center justify-center opacity-60"
                aria-label="End"
              >
                The End ✨
              </button>
            ) : (
              <button
                onClick={next}
                className="h-12 px-5 rounded-full bg-primary hover:bg-primary-dark text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-primary/30"
                aria-label="Next card"
              >
                Next →
              </button>
            )}
          </div>
        </WrapCard>
      </AnimatePresence>
    </>
  )
}
