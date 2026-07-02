import { useState, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  REQUIRED_RESPONSES,
  deriveType,
  deriveArchetype,
  HATS,
  SDT_NEEDS,
  BELBIN_ROLES,
  VIA_STRENGTHS,
  CANDOR_ITEMS,
  ENERGIZER_ACTIVITIES,
  type Session,
  type BigFiveScores,
  type EnergizerTags,
  type ResponsibilityTiers,
  type HatScores,
  type VirtueScores,
} from '@fishbowl/feedback-core'
import { getSession } from '../lib/data'
import { questions } from '../data/questions'
import { getSelfReport, getSelfInsight, getSynthesis, type SelfData, type SelfInsight, type SelfSynthesis } from '../lib/self'
import { useAiInsights } from '../lib/aiInsights'
import { topPercent } from '../lib/percentile'
import Card from '../components/Card'
import VirtueGauge from '../components/VirtueGauge'
import StatBar from '../components/StatBar'
import PersonalityCard, { SideCharacter } from '../components/PersonalityCard'
import LockedCard from '../components/LockedCard'
import RelinkPrompt from '../components/RelinkPrompt'
import EntryModal from '../components/EntryModal'
import EnergyOverlay from '../components/EnergyOverlay'
import ResponsibilitiesLadder from '../components/ResponsibilitiesLadder'
import HatsRadar from '../components/HatsRadar'
import BlindSpotQuadrant from '../components/BlindSpotQuadrant'
import ThroughLine from '../components/ThroughLine'
import VirtueViceDial from '../components/VirtueViceDial'
import VirtuousHumanScore from '../components/VirtuousHumanScore'
import FourRooms from '../components/FourRooms'
import LockedDoor from '../components/LockedDoor'
import SpineParallax from '../components/SpineParallax'
import HeatCurve from '../components/HeatCurve'
import RoleTriangle from '../components/RoleTriangle'
import Constellation from '../components/Constellation'
import CandorPlot from '../components/CandorPlot'
import SdtProfile from '../components/SdtProfile'
import BelbinReport from '../components/BelbinReport'
import BelbinComposition from '../components/BelbinComposition'
import StrengthsPodium from '../components/StrengthsPodium'
import TodoList from '../components/TodoList'
import OneOnOne from '../components/OneOnOne'
import StickyNote from '../components/StickyNote'
import ViaDeck from '../components/ViaDeck'
import JohariWindow from '../components/JohariWindow'
import WatchoutsDeck from '../components/WatchoutsDeck'
import { WEAKNESSES } from '@fishbowl/feedback-core'
import InfoTip from '../components/InfoTip'
import Rich from '../components/Rich'

// Map every scenario option to its tendency (deficient / balanced / excessive) so a
// room's verdict matches the exact behaviour the team picked.
const OPTION_TENDENCY: Record<string, string> = {}
for (const q of questions) {
  const ot = (q as { optionTendencies?: Record<string, string> }).optionTendencies
  if (ot) Object.assign(OPTION_TENDENCY, ot)
}

// Per-Belbin-role colour, grouped by cluster hue (Thinking = blues, Action = pinks,
// People = greens/gold) — for the composite role-composition bar.
const BELBIN_COLOR: Record<string, string> = {
  plant: '#1366ac', monitor_evaluator: '#4a90c2', specialist: '#86b8d8',
  shaper: '#a83f6f', implementer: '#d0668f', completer_finisher: '#e6a6c1',
  coordinator: '#3f9d5a', teamworker: '#79b98a', resource_investigator: '#c9a24a',
}

// Which Belbin cluster each energizer activity pulls toward — for the "where you'd
// rather be" role triangle.
const ENERGIZER_CLUSTER: Record<string, 'thinking' | 'action' | 'people'> = {
  connect: 'people', present: 'people', deepwork: 'thinking', plan: 'action', firefight: 'action',
  mentor: 'people', analyze: 'thinking', negotiate: 'people', ideate: 'thinking', execute: 'action',
  lead: 'action', reflect: 'people',
}

function Screen({ children }: { children: ReactNode }) {
  return <div className="mx-auto grid min-h-dvh max-w-lg place-items-center px-5 text-center">{children}</div>
}

export default function Results() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [pct, setPct] = useState<Record<string, number>>({})
  // The population "top X%" for the composite Virtuous Human Score (team read).
  const [scorePct, setScorePct] = useState<number | null>(null)
  const [idx, setIdx] = useState(0)
  // Index of the deep "full read" card, set while building the deck below so the intro
  // card can jump straight to it (people were stopping short and missing the centerpiece).
  const fullReadIdxRef = useRef(-1)
  const [self, setSelf] = useState<SelfData | null>(null)
  const [hasSelf, setHasSelf] = useState(false)
  const [selfLoaded, setSelfLoaded] = useState(false)
  const [modalDismissed, setModalDismissed] = useState(false)
  const [synthesis, setSynthesis] = useState<SelfSynthesis | null>(null)
  const [synthesisLoading, setSynthesisLoading] = useState(false)
  const [selfInsight, setSelfInsight] = useState<SelfInsight | null>(null)
  const [selfInsightLoading, setSelfInsightLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!slug) return
    getSession(slug).then((s) => {
      setSession(s)
      setLoading(false)
    })
    getSelfReport(slug).then((r) => {
      setSelf(r.self)
      setHasSelf(r.hasSelf)
      setSelfLoaded(true)
    })
  }, [slug])

  const { insights, regenerate, regenerating, isStale, error: insightsError } = useAiInsights(
    session?.id,
    session?.response_count,
    Boolean(session)
  )

  useEffect(() => {
    if (!insights) return
    let cancelled = false
    ;(async () => {
      const vs = await Promise.all(
        insights.virtues.map(async (v) => [v.dimension, await topPercent(v.dimension, v.mu, false)] as const)
      )
      const cs = await Promise.all(
        insights.competencies.map(async (c) => [c.dimension, await topPercent(c.dimension, c.average, true)] as const)
      )
      if (!cancelled) setPct(Object.fromEntries([...vs, ...cs]))
    })()
    return () => {
      cancelled = true
    }
  }, [insights])

  // Population rank for the composite Virtuous Human Score. There's no population
  // norm for the blended score itself, so we approximate it from the per-dimension
  // "top X%" the app already computes (balance-based, higher-is-best=false) across
  // every virtue and hat, then average — grounded in the live norm when it exists
  // and the seeded default otherwise.
  useEffect(() => {
    if (!insights) return
    let cancelled = false
    ;(async () => {
      const dims = [
        ...insights.virtues.map((v) => ({ dimension: v.dimension, score: v.mu })),
        ...((insights.hats ?? []).filter((h) => h.n > 0).map((h) => ({ dimension: h.key, score: h.mu }))),
      ]
      if (dims.length === 0) {
        if (!cancelled) setScorePct(null)
        return
      }
      const tops = await Promise.all(dims.map((d) => topPercent(d.dimension, d.score, false)))
      if (!cancelled) setScorePct(Math.round(tops.reduce((a, b) => a + b, 0) / tops.length))
    })()
    return () => {
      cancelled = true
    }
  }, [insights])

  // The deep cross-referenced "full read" — bearer-gated, generated with extended
  // thinking. Pass the derived archetype so the synthesis can weave it through.
  useEffect(() => {
    if (!slug || !hasSelf || !insights || !self) return
    let cancelled = false
    setSynthesisLoading(true)
    const virtueMeans = Object.fromEntries(insights.virtues.map((v) => [v.dimension, v.mu]))
    const a = deriveArchetype(self.big_five ?? null, virtueMeans)
    const archPayload = a ? { name: a.name, essence: a.essence, light: a.light, shadow: a.shadow, runnerUp: a.runnerUp } : null
    getSynthesis(slug, archPayload).then((r) => {
      if (cancelled) return
      setSynthesis(r)
      setSynthesisLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [slug, hasSelf, insights, self])

  // The private "you vs them" narrative (bearer-gated) — kept alongside the new visual
  // self-vs-team slides until we decide which to retire.
  useEffect(() => {
    if (!slug || !hasSelf || !insights) return
    let cancelled = false
    setSelfInsightLoading(true)
    getSelfInsight(slug).then((r) => {
      if (cancelled) return
      setSelfInsight(r)
      setSelfInsightLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [slug, hasSelf, insights])

  if (loading) {
    return (
      <Screen>
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.1 }} className="text-5xl">
          🐟
        </motion.div>
      </Screen>
    )
  }
  if (!session) {
    return (
      <Screen>
        <p className="display text-3xl">This report doesn't exist.</p>
      </Screen>
    )
  }
  if ((session.response_count || 0) < REQUIRED_RESPONSES) {
    const remaining = REQUIRED_RESPONSES - (session.response_count || 0)
    return (
      <Screen>
        <Card tone="sand" className="w-full p-9">
          <div className="text-6xl">🔒</div>
          <h1 className="display mt-4 text-4xl">Not yet.</h1>
          <p className="mt-3 text-lg text-ink-soft">
            {remaining} more {remaining === 1 ? 'colleague' : 'colleagues'} need to answer before your report unlocks.
          </p>
        </Card>
      </Screen>
    )
  }
  if (!insights) {
    return (
      <Screen>
        <Card tone="paper" className="w-full p-9">
          {insightsError ? (
            <>
              <div className="text-6xl">😵‍💫</div>
              <h1 className="display mt-4 text-4xl">That didn't go through.</h1>
              <p className="mt-3 text-lg text-ink-soft">We hit a snag writing your report. Give it another go.</p>
              <button
                onClick={regenerate}
                disabled={regenerating}
                className="press mt-6 cursor-pointer rounded-2xl border-[2.5px] border-ink bg-pink sc-pink px-6 py-3 font-display font-black text-ink shadow-chunky-sm"
              >
                {regenerating ? 'Trying…' : 'Try again'}
              </button>
            </>
          ) : (
            <>
              <motion.div animate={{ scale: [1, 1.12, 1] }} transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }} className="text-6xl">
                ✍️
              </motion.div>
              <h1 className="display mt-4 text-4xl">Writing your report…</h1>
              <p className="mt-3 text-lg text-ink-soft">
                We're generating a fresh read right now. This takes up to a minute, and it'll appear here on its own, no need to refresh.
              </p>
            </>
          )}
        </Card>
      </Screen>
    )
  }

  // ── Build the deck ──
  const mostBalanced = [...insights.virtues].sort((a, b) => b.balanceScore - a.balanceScore)[0]
  const selfVirtues = hasSelf
    ? ((self?.self_payload as Record<string, unknown> | undefined)?.virtues as VirtueScores | undefined)
    : undefined

  // The AI's one-line takeaway for a given slide (from the synthesis). Rendered under
  // the slide title so each visual carries a single sharp sentence, not a paragraph.
  const cap = (key: string) => {
    const t = synthesis?.captions?.[key]
    if (!t) return null
    return (
      <p className="serif mb-5 -mt-1 text-lg italic leading-snug text-pink-deep">
        <Rich text={t} />
      </p>
    )
  }

  const cards: { tone: Parameters<typeof Card>[0]['tone']; node: ReactNode; character?: { type: string; name: string } }[] = [
    {
      tone: 'pink',
      node: (
        <div className="flex min-h-[60vh] flex-col justify-center">
          <p className="kicker text-ink/70">your fishbowl</p>
          <h1 className="display mt-4 text-[clamp(2.4rem,7vw,4.5rem)] text-ink">
            <Rich text={insights.headline} />
          </h1>
          <p className="mt-6 text-ink/70">{session.response_count} colleagues. One honest mirror.</p>
          {hasSelf && (synthesis || synthesisLoading) && (
            <button
              onClick={() => fullReadIdxRef.current >= 0 && setIdx(fullReadIdxRef.current)}
              className="press mt-8 w-fit cursor-pointer rounded-full border-[2.5px] border-ink bg-paper-hi px-5 py-3 font-display font-black text-ink shadow-chunky-sm"
            >
              📖 Skip to your full written read →
            </button>
          )}
          {!hasSelf && slug && <RelinkPrompt slug={slug} />}
        </div>
      ),
    },
    {
      tone: 'paper',
      node: (
        <div>
          <p className="kicker mb-2 text-pink-deep">where you shine · your top 5</p>
          {cap('strengths')}
          <StrengthsPodium strengths={insights.topStrengths} />
        </div>
      ),
    },
    {
      tone: 'paper',
      node: (
        <div>
          <p className="kicker mb-1 text-blue-deep">
            your balance
            <InfoTip text="Aristotle's golden mean: every strength is the midpoint between two vices. The middle — not the extreme — is the virtue." />
          </p>
          <h2 className="display mb-4 text-3xl">The ten virtues</h2>
          {cap('virtues')}
          <div className="flex flex-col gap-4">
            {insights.virtues.map((v) => (
              <VirtueGauge
                key={v.dimension}
                name={v.name}
                mu={v.mu}
                deficientPole={v.deficientPole}
                excessivePole={v.excessivePole}
                self={selfVirtues?.[v.dimension]}
              />
            ))}
          </div>
          {selfVirtues && Object.keys(selfVirtues).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-ink-soft">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full border-2 border-ink bg-blue" /> your team
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full border-2 border-ink bg-pink" /> you
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-4 rounded-full" style={{ backgroundColor: '#5e2746' }} /> a notable gap
              </span>
            </div>
          )}
        </div>
      ),
    },
    {
      tone: 'blue',
      node: (
        <div className="flex min-h-[55vh] flex-col justify-center">
          <p className="kicker text-paper-hi/80">most balanced</p>
          {pct[mostBalanced.dimension] != null && (
            <p className="display mt-2 text-7xl text-paper-hi">top {pct[mostBalanced.dimension]}%</p>
          )}
          <p className="serif mt-1 text-3xl text-paper-hi">on {mostBalanced.name}</p>
          <p className="mt-5 text-lg leading-relaxed text-paper-hi/90">
            <Rich text={mostBalanced.blurb} />
          </p>
        </div>
      ),
    },
    {
      tone: 'paper',
      node: (
        <div>
          <p className="kicker mb-1 text-pink-deep">at work</p>
          <h2 className="display mb-5 text-3xl">How they rate you</h2>
          <div className="flex flex-col gap-4">
            {insights.competencies.map((c) => (
              <StatBar key={c.dimension} label={c.statement} value={c.average} percent={pct[c.dimension]} />
            ))}
          </div>
        </div>
      ),
    },
    {
      tone: 'sand',
      node: (
        <div>
          <p className="kicker mb-5 text-pink-deep">what they appreciate</p>
          <ul className="flex flex-col gap-4">
            {insights.appreciations.map((a, i) => (
              <li key={i} className="flex gap-3 text-xl leading-relaxed">
                <span className="text-pink-deep">❤</span>
                <span>
                  <Rich text={a} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      ),
    },
    {
      tone: 'ink',
      node: (
        <div className="flex min-h-[55vh] flex-col justify-center">
          <p className="kicker text-blue">one last thing</p>
          <p className="serif mt-4 text-3xl leading-snug text-paper-hi">
            <Rich text={insights.closing} />
          </p>
          {isStale && (
            <button
              onClick={regenerate}
              disabled={regenerating}
              className="press mt-8 self-start cursor-pointer rounded-full border-[2.5px] border-paper-hi bg-blue px-5 py-2.5 font-display font-black text-ink"
            >
              {regenerating ? 'Refreshing…' : 'New answers came in · refresh'}
            </button>
          )}
        </div>
      ),
    },
  ]

  // ── Self layer (bearer-gated): Type card + OCEAN dials, locked until the
  // subject self-assesses. Locked cards blur a teaser to make the nudge enticing.
  const goSelf = () => navigate(`/self/${slug}`)
  const teaserBig: BigFiveScores = {
    openness: 74,
    conscientiousness: 62,
    extraversion: 58,
    agreeableness: 67,
    neuroticism: 34,
    emotionalStability: 66,
  }
  const teaserType = deriveType(teaserBig)
  const selfCards: { tone: Parameters<typeof Card>[0]['tone']; node: ReactNode; character?: { type: string; name: string } }[] = [
    {
      tone: 'paper',
      // On wide screens the Disney character stands in the margin to the right of this
      // card (only once the subject has self-assessed, never for the locked teaser).
      ...(hasSelf && self?.mbti?.character ? { character: { type: self.mbti.type, name: self.mbti.character } } : {}),
      node: (
        <div>
          {hasSelf && self?.mbti && self?.big_five ? (
            <PersonalityCard mbti={self.mbti} scores={self.big_five} sideChar />
          ) : (
            <LockedCard caption="Take the self-read to reveal your type and five traits." onUnlock={goSelf}>
              <PersonalityCard mbti={teaserType} scores={teaserBig} />
            </LockedCard>
          )}
        </div>
      ),
    },
  ]
  cards.splice(1, 0, ...selfCards)

  // Archetype: derived from the team virtue means (always), blended with the subject's
  // Big Five when they've self-assessed. Placed late in the deck (a closing lens), well
  // after the personality card.
  const virtueMeans = Object.fromEntries(insights.virtues.map((v) => [v.dimension, v.mu]))
  const archetype = deriveArchetype(hasSelf ? (self?.big_five ?? null) : null, virtueMeans)
  const archCard: { tone: Parameters<typeof Card>[0]['tone']; node: ReactNode } | null = archetype
    ? {
        tone: 'ink',
        node: (
          <div className="flex min-h-[55vh] flex-col justify-center text-center">
            <p className="kicker text-blue">
              your Jungian archetype
              <InfoTip text="The 12 archetypes Mark & Pearson distilled from Jung. We read it from how you and your team already answered, earned, not self-claimed. Every archetype has a bright side and a shadow. A fun lens, not a test." />
            </p>
            <p className="display mt-3 text-[clamp(2.6rem,8vw,4rem)] text-paper-hi">{archetype.name}</p>
            <p className="serif mt-2 text-lg text-paper-hi/80">{archetype.essence}</p>
            <p className="mt-5 text-lg leading-relaxed text-paper-hi/90">
              {archetype.cardTemplate.replace('{name}', session.creator_name)}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-left">
              <div className="rounded-2xl border-2 border-blue/40 bg-blue/15 p-3">
                <p className="kicker text-blue">☀ Light</p>
                <p className="mt-1 text-sm leading-snug text-paper-hi/90">{archetype.light}</p>
              </div>
              <div className="rounded-2xl border-2 border-pink/40 bg-pink/10 p-3">
                <p className="kicker text-pink">☾ Shadow</p>
                <p className="mt-1 text-sm leading-snug text-paper-hi/90">{archetype.shadow}</p>
              </div>
            </div>
            <p className="mt-5 text-sm text-paper-hi/60">
              with a touch of {archetype.runnerUp}
              {archetype.fromSelf ? '' : ' · take your self-read to sharpen this'}
            </p>
          </div>
        ),
      }
    : null

  // Energizers: a self-only lens — only the subject can say what energizes or drains
  // them, so colleagues are never asked. Shows once they've self-assessed.
  const selfEnergizers = hasSelf ? ((self?.self_payload?.energizers as EnergizerTags | undefined) ?? null) : null
  if (selfEnergizers && Object.keys(selfEnergizers).length > 0) {
    const energyRows = ENERGIZER_ACTIVITIES
      .filter((a) => typeof selfEnergizers[a.id] === 'number')
      .map((a) => ({ id: a.id, label: a.label, teamMean: 0, n: 0 }))
    const energyCard = {
      tone: 'paper' as const,
      node: (
        <div>
          <p className="kicker mb-1 text-pink-deep">
            energy
            <InfoTip text="Marcus Buckingham's strengths idea: a strength is an activity that energizes you, not merely one you're good at. This one's yours alone — only you can know what lifts or drains you." />
          </p>
          <h2 className="display mb-1 text-3xl">What lifts you, what drains you</h2>
          <p className="mb-3 text-sm text-ink-soft">Your own read — only you can call this one.</p>
          {cap('energy')}
          <EnergyOverlay team={energyRows} self={selfEnergizers} />
        </div>
      ),
    }
    cards.splice(cards.length - 1, 0, energyCard)
  }

  // Responsibilities ladder: team tiers always (>=5); self tiers overlay once self-assessed.
  const selfTiers = hasSelf ? ((self?.self_payload?.responsibility_tiers as ResponsibilityTiers | undefined) ?? null) : null
  const teamResp = insights.responsibilities ?? []
  const teamRespHasData = teamResp.some((r) => r.n > 0)
  const respRows = teamRespHasData
    ? teamResp
    : (self?.responsibilities ?? []).map((label, index) => ({ index, label, teamTier: 2, n: 0 }))
  if (teamRespHasData || (selfTiers && Object.keys(selfTiers).length > 0 && respRows.length > 0)) {
    const respCard = {
      tone: 'paper' as const,
      node: (
        <div>
          <p className="kicker mb-1 text-pink-deep">
            their role
            <InfoTip text="A behaviorally-anchored rating scale (BARS): describing performance at three concrete levels is more useful and less halo-biased than a single score." />
          </p>
          <h2 className="display mb-1 text-3xl">How you deliver</h2>
          <p className="mb-5 text-sm text-ink-soft">
            {teamRespHasData
              ? `Where your team puts you on what you own${hasSelf ? ', next to your own read' : ''}.`
              : 'Your own read on what you own.'}
          </p>
          {cap('responsibilities')}
          <ResponsibilitiesLadder team={respRows} self={selfTiers} />
          {!hasSelf && (
            <button
              onClick={goSelf}
              className="press mt-5 w-full cursor-pointer rounded-2xl border-[2.5px] border-ink bg-pink sc-pink px-5 py-3 font-display font-black text-ink shadow-chunky-sm"
            >
              Take your self-read to overlay your view →
            </button>
          )}
        </div>
      ),
    }
    cards.splice(cards.length - 1, 0, respCard)
  }

  // ── Phase 3 framework cards — team layer at >=5; self overlays once self-assessed ──
  const sp = (self?.self_payload ?? {}) as Record<string, unknown>
  const fwCards: { tone: Parameters<typeof Card>[0]['tone']; node: ReactNode }[] = []

  const selfHats = hasSelf ? ((sp.hats as HatScores) ?? null) : null
  if (insights.hats?.some((h) => h.n > 0) || (selfHats && Object.keys(selfHats).length > 0)) {
    const team = (insights.hats ?? []).map((h) => ({ key: h.key, label: HATS.find((x) => x.key === h.key)?.mode ?? h.key, mu: h.mu, n: h.n }))
    fwCards.push({
      tone: 'paper',
      node: (
        <div>
          <p className="kicker mb-1 text-blue-deep">
            thinking style
            <InfoTip text="Edward de Bono's Six Thinking Hats — six modes of thought (facts, feelings, optimism, caution, creativity, process). The radar shows the shape of how you think: how strongly each mode shows up." />
          </p>
          <h2 className="display mb-4 text-3xl">Six thinking hats</h2>
          {cap('hats')}
          <HatsRadar team={team} self={selfHats} />
        </div>
      ),
    })
  }

  if (insights.radicalCandor && insights.radicalCandor.n > 0) {
    const rc = insights.radicalCandor
    const selfRC = hasSelf ? (sp.radical_candor as Record<string, number> | undefined) : undefined
    const axisMean = (axis: 'care' | 'challenge') => {
      if (!selfRC) return null
      const vals = CANDOR_ITEMS.filter((i) => i.axis === axis)
        .map((i) => selfRC[i.id])
        .filter((v): v is number => typeof v === 'number')
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    }
    fwCards.push({
      tone: 'paper',
      node: (
        <div>
          <p className="kicker mb-1 text-pink-deep">
            feedback style
            <InfoTip text="Kim Scott's Radical Candor — caring personally while challenging directly. The other three corners (Ruinous Empathy, Obnoxious Aggression, Manipulative Insincerity) are common failure modes. Situational, not a fixed trait." />
          </p>
          <h2 className="display mb-5 text-3xl">Care × challenge</h2>
          <CandorPlot teamCare={rc.teamCare} teamChallenge={rc.teamChallenge} selfCare={axisMean('care')} selfChallenge={axisMean('challenge')} />
        </div>
      ),
    })
  }

  // SDT + Belbin detail slides.
  if (insights.sdt?.some((s) => s.n > 0)) {
    const sdtTeam = insights.sdt.map((s) => ({ key: s.key, label: SDT_NEEDS.find((x) => x.key === s.key)?.label ?? s.key, meanPoints: s.meanPoints, n: s.n }))
    fwCards.push({
      tone: 'sand',
      node: (
        <div>
          <p className="kicker mb-1 text-blue-deep">
            what you fuel
            <InfoTip text="Self-Determination Theory (Deci & Ryan): the needs people feel met — autonomy, competence, relatedness, plus purpose, safety and vitality. What do you leave in your colleagues' tanks?" />
          </p>
          <h2 className="display mb-5 text-3xl">What you fuel in others</h2>
          <SdtProfile team={sdtTeam} />
        </div>
      ),
    })
  }
  const selfBelbin = hasSelf ? ((sp.belbin as Record<string, number>) ?? null) : null
  if (insights.belbin?.some((b) => b.n > 0) || (selfBelbin && Object.keys(selfBelbin).length > 0)) {
    const belbinTeam = (insights.belbin ?? []).map((b) => {
      const r = BELBIN_ROLES.find((x) => x.key === b.key)
      return { key: b.key, name: r?.name ?? b.key, cluster: r?.cluster ?? 'Thinking', teamShare: b.teamShare, n: b.n }
    })
    // Composite composition: each role = 50% self allocation + 50% team share.
    const teamShareMap = new Map((insights.belbin ?? []).map((b) => [b.key, b.teamShare]))
    const selfTot = selfBelbin ? Object.values(selfBelbin).reduce((a, b) => a + (b || 0), 0) : 0
    const rawComposite = BELBIN_ROLES.map((r) => {
      const team = teamShareMap.get(r.key) ?? 0
      const self = selfBelbin && selfTot > 0 ? (selfBelbin[r.key] ?? 0) / selfTot : 0
      const composite = selfTot > 0 ? 0.5 * self + 0.5 * team : team
      return { key: r.key, name: r.name, composite }
    })
    const compTot = rawComposite.reduce((a, r) => a + r.composite, 0) || 1
    const belbinComposite = rawComposite
      .map((r) => ({ name: r.name, pct: (r.composite / compTot) * 100, color: BELBIN_COLOR[r.key] ?? '#b8ab97' }))
      .filter((s) => s.pct > 0)
      .sort((a, b) => b.pct - a.pct)
    fwCards.push({
      tone: 'paper',
      node: (
        <div>
          <p className="kicker mb-1 text-pink-deep">
            team role
            <InfoTip text="Belbin's nine team roles — the distinct ways people contribute, grouped Thinking / Action / People. The bar blends your own read (50%) with the team's (50%)." />
          </p>
          <h2 className="display mb-4 text-3xl">The roles you play</h2>
          <p className="mb-2 text-sm text-ink-soft">Your role mix — your read and the team's, weighted equally.</p>
          <BelbinComposition segments={belbinComposite} />
          <div className="mt-6">
            <BelbinReport team={belbinTeam} self={selfBelbin} />
          </div>
        </div>
      ),
    })
  }

  // Treat an empty array as "not done" (a depth that skipped this framework saves []),
  // so the card shows the graceful team-only view instead of an empty self overlay.
  const selfArr = (v: unknown): string[] | null =>
    hasSelf && Array.isArray(v) && v.length > 0 ? (v as string[]) : null
  const selfVia = selfArr(sp.via)
  if (insights.via?.length || (selfVia && selfVia.length > 0)) {
    const team = (insights.via ?? []).map((v) => {
      const s = VIA_STRENGTHS.find((x) => x.id === v.id)
      return { id: v.id, name: s?.name ?? v.id, virtue: s?.virtue ?? '', count: v.count }
    })
    fwCards.push({
      tone: 'paper',
      node: (
        <div>
          <p className="kicker mb-1 text-blue-deep">
            signature strengths
            <InfoTip text="The VIA Classification (Peterson & Seligman) — 24 character strengths under 6 virtues. Your signature strengths (the top few) feel the most energizing and authentic." />
          </p>
          <h2 className="display mb-5 text-3xl">Your top strengths</h2>
          <ViaDeck team={team} self={selfVia} total={insights.via?.[0]?.n ?? 0} />
        </div>
      ),
    })
  }

  const selfJohari = selfArr(sp.johari)
  if ((insights.johari && insights.johari.counts.length) || (selfJohari && selfJohari.length > 0)) {
    fwCards.push({
      tone: 'paper',
      node: (
        <div>
          <p className="kicker mb-1 text-pink-deep">
            the window
            <InfoTip text="The Johari Window (Luft & Ingham): comparing the words you pick for yourself with the words your team picks reveals your Open self, your Blind Spots, and what's Hidden. A reflective lens." />
          </p>
          <h2 className="display mb-5 text-3xl">Johari window</h2>
          <JohariWindow teamCounts={insights.johari?.counts ?? []} self={selfJohari} n={insights.johari?.n ?? 0} />
        </div>
      ),
    })
  }

  // Watch-outs (the mirror of strengths). Kindness guard: a word only surfaces in
  // the team views when at least two colleagues named it, so one off-day or one
  // harsh read doesn't define anyone.
  const selfNohari = selfArr(sp.nohari)
  const teamNohari = (insights.nohari?.counts ?? []).filter((c) => c.count >= 2)
  const hasNohari = teamNohari.length > 0 || (selfNohari !== null && selfNohari.length > 0)
  if (hasNohari) {
    fwCards.push({
      tone: 'paper',
      node: (
        <div>
          <p className="kicker mb-1 text-pink-deep">
            watch-outs
            <InfoTip text="The flip side of your strengths — the behaviours colleagues flagged as things to watch. A word only shows here when at least two people named it, so a single off-day or one harsh read doesn't define you. Meant kindly: these are edges to soften, not verdicts." />
          </p>
          <h2 className="display mb-4 text-3xl">Your top watch-outs</h2>
          {cap('watchouts')}
          <WatchoutsDeck team={teamNohari} self={selfNohari} total={insights.nohari?.n ?? 0} />
        </div>
      ),
    })
    fwCards.push({
      tone: 'paper',
      node: (
        <div>
          <p className="kicker mb-1 text-pink-deep">
            the other window
            <InfoTip text="The Nohari Window — the shadow side of Johari. The same four-pane idea applied to growth areas: comparing the watch-outs you own against the ones your team names reveals your Open edges, your Blind Spots, and what's still Hidden." />
          </p>
          <h2 className="display mb-5 text-3xl">Nohari window</h2>
          <JohariWindow teamCounts={teamNohari} self={selfNohari} n={insights.nohari?.n ?? 0} total={WEAKNESSES.length} dense />
        </div>
      ),
    })
  }

  for (const c of fwCards) cards.splice(cards.length - 1, 0, c)

  // The Jungian archetype sits late, just before the closing.
  if (archCard) cards.splice(cards.length - 1, 0, archCard)

  // Self-vs-team, as pictures (bearer-gated). Two fixed, data-driven slides that
  // replace the old text "you vs them" card: a dumbbell of every gap, then a blind
  // spot / hidden strength quadrant. Needs both self virtue picks and team means.
  const gapRows = hasSelf && selfVirtues
    ? insights.virtues
        .map((v) => ({ label: v.name, self: selfVirtues[v.dimension] as number, team: v.mu }))
        .filter((r) => typeof r.self === 'number' && !Number.isNaN(r.self))
        .sort((a, b) => Math.abs(b.self - b.team) - Math.abs(a.self - a.team))
    : []
  if (gapRows.length > 0) {
    cards.splice(cards.length - 1, 0, {
      tone: 'paper',
      node: (
        <div>
          <p className="kicker mb-1 text-pink-deep">
            the map
            <InfoTip text="Every trait plotted: across = how the team rates you, up = how you rate yourself. Off the diagonal is where you and the team disagree — blind spots above it, hidden strengths below." />
          </p>
          <h2 className="display mb-4 text-3xl">Blind spots &amp; hidden strengths</h2>
          {cap('blindspots')}
          <BlindSpotQuadrant points={gapRows} />
        </div>
      ),
    })
  }

  // The original private "you vs them" narrative card (kept alongside the visual
  // dumbbell + quadrant; we'll decide together which to retire).
  if (hasSelf && (selfInsight || selfInsightLoading)) {
    cards.splice(cards.length - 1, 0, {
      tone: 'sand',
      node: (
        <div>
          <p className="kicker mb-1 text-pink-deep">
            you vs them · in words
            <InfoTip text="A private read comparing your self-assessment against how your team sees you. Only you can see this." />
          </p>
          <h2 className="display mb-4 text-3xl">Your read, meet theirs</h2>
          {selfInsight ? (
            <>
              <p className="serif mb-4 text-xl leading-snug text-ink">{selfInsight.headline}</p>
              <ul className="flex flex-col gap-3">
                {selfInsight.insights.map((t, i) => (
                  <li key={i} className="flex gap-2 leading-relaxed text-ink">
                    <span className="text-pink-deep">•</span>
                    <span>
                      <Rich text={t} />
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-ink-soft">Reading the gaps between how you see yourself and how your team does…</p>
          )}
        </div>
      ),
    })
  }

  // ── Phase C: compound slides — synthetic sections fusing several frameworks into
  // one picture (bearer-gated; each shows only when its data supports it). ──

  // Strength & shadow: virtues the team pushes toward an extreme, as redline dials.
  const viceDials = insights.virtues
    .filter((v) => v.mu > 6 || v.mu < 4)
    .sort((a, b) => Math.abs(b.mu - 5) - Math.abs(a.mu - 5))
    .slice(0, 4)
    .map((v) => ({ def: v.deficientPole, exc: v.excessivePole, score: v.mu }))
  const hotHat = [...(insights.hats ?? [])].filter((h) => h.n > 0).sort((a, b) => b.mu - a.mu)[0]
  const hotHatName = hotHat ? HATS.find((h) => h.key === hotHat.key)?.name ?? '' : ''
  if (hasSelf && viceDials.length > 0 && archetype) {
    cards.splice(cards.length - 1, 0, {
      tone: 'paper',
      node: (
        <div>
          <p className="kicker mb-1 text-pink-deep">
            strength &amp; shadow
            <InfoTip text="Aristotle's golden mean: every virtue becomes a vice at the extreme. These are the virtues the team pushes you past centre, and the archetype shadow + thinking hat driving all of them." />
          </p>
          <h2 className="display mb-4 text-3xl">Where your strengths tip over</h2>
          {cap('vice')}
          <VirtueViceDial dials={viceDials} engine={{ shadow: archetype.shadow, hat: hotHatName }} />
        </div>
      ),
    })
  }

  // Behaviour in motion: the 3 scenarios (+ default gear) as four situation rooms.
  const ROOM_META: Record<string, { label: string; hatLabel: string; hatColor: string }> = {
    conflict_style: { label: 'In conflict', hatLabel: 'Red', hatColor: '#e0607d' },
    deadline_style: { label: 'Deadline slips', hatLabel: 'Black', hatColor: '#333333' },
    feedback_style: { label: 'Getting feedback', hatLabel: 'Red', hatColor: '#e0607d' },
  }
  const HAT_COLOR: Record<string, string> = {
    hat_white: '#e6e0d2', hat_red: '#e0607d', hat_yellow: '#f0c419', hat_black: '#333333', hat_green: '#5aa469', hat_blue: '#1366ac',
  }
  const scenarioRooms = (insights.scenarios ?? [])
    .map((s) => {
      const meta = ROOM_META[s.dimension]
      if (!meta) return null
      const balanced = OPTION_TENDENCY[s.winner] === 'balanced'
      return { label: meta.label, behavior: s.winner, verdict: (balanced ? 'balanced' : 'off') as 'balanced' | 'off', hatLabel: meta.hatLabel, hatColor: meta.hatColor }
    })
    .filter((r): r is { label: string; behavior: string; verdict: 'balanced' | 'off'; hatLabel: string; hatColor: string } => r !== null)
  if (hasSelf && scenarioRooms.length >= 3) {
    const fourth = hotHat
      ? { label: 'Your default gear', behavior: `You lead with the ${hotHatName} hat`, verdict: 'balanced' as const, hatLabel: hotHatName, hatColor: HAT_COLOR[hotHat.key] ?? '#b8ab97' }
      : null
    const rooms = fourth ? [...scenarioRooms.slice(0, 3), fourth] : scenarioRooms.slice(0, 4)
    cards.splice(cards.length - 1, 0, {
      tone: 'sand',
      node: (
        <div>
          <p className="kicker mb-1 text-blue-deep">
            behaviour in motion
            <InfoTip text="You are not one style — you shift by situation. Each room is a scenario your team rated; the border lights amber where your balance breaks." />
          </p>
          <h2 className="display mb-4 text-3xl">A day in four rooms</h2>
          {cap('rooms')}
          <FourRooms rooms={rooms} />
        </div>
      ),
    })
  }

  // Why it persists: high confidence + low receptiveness = a blind spot only they can open.
  const confSelf = selfVirtues?.confidence
  const recVirtue = insights.virtues.find((v) => v.dimension === 'receptiveness')
  const recSelf = selfVirtues?.receptiveness
  const johariBlind = (insights.johari?.counts ?? []).map((c) => c.word).filter((w) => !(selfJohari ?? []).includes(w)).slice(0, 4)
  if (hasSelf && typeof confSelf === 'number' && recVirtue && typeof recSelf === 'number' && confSelf >= 5.5 && recSelf <= recVirtue.mu) {
    cards.splice(cards.length - 1, 0, {
      tone: 'paper',
      node: (
        <div>
          <p className="kicker mb-1 text-pink-deep">
            why it persists
            <InfoTip text="The trait that would let you see a blind spot (receptiveness) is the one running low, while confidence runs high — so the door only opens from the outside." />
          </p>
          <h2 className="display mb-5 text-3xl">The locked door</h2>
          {cap('lockedDoor')}
          <LockedDoor confidence={confSelf} receptiveness={{ self: recSelf, team: recVirtue.mu }} blindWords={johariBlind} />
        </div>
      ),
    })
  }

  // Phase C wave 2 — five more compound slides.

  // The kindness trap: team care/challenge vs a self-view from Agreeableness + Candor virtue.
  const kAgree = self?.big_five?.agreeableness
  const kCandor = selfVirtues?.candor
  if (hasSelf && insights.radicalCandor && insights.radicalCandor.n > 0 && typeof kAgree === 'number' && typeof kCandor === 'number') {
    const rc = insights.radicalCandor
    cards.splice(cards.length - 1, 0, {
      tone: 'sand',
      node: (
        <div>
          <p className="kicker mb-1 text-pink-deep">
            the gap · candor
            <InfoTip text="Radical Candor (care × challenge). The hollow point is where your warmth (Agreeableness) and self-rated Candor would put you; the solid point is where the team actually lands. The distance is the trap." />
          </p>
          <h2 className="display mb-4 text-3xl">The kindness trap</h2>
          <CandorPlot teamCare={rc.teamCare} teamChallenge={rc.teamChallenge} selfCare={(kAgree / 100) * 8 + 1} selfChallenge={kCandor} />
        </div>
      ),
    })
  }

  // The blind-spot parallax: pool every self-vs-team item onto one spine to show the tilt.
  const parItems: { label: string; self: number; team: number; kind: 'blind' | 'hidden' }[] = []
  insights.virtues.forEach((v) => {
    const s = selfVirtues?.[v.dimension]
    if (typeof s === 'number' && Math.abs(s - v.mu) >= 1.3) parItems.push({ label: v.name, self: (s - 1) / 8, team: (v.mu - 1) / 8, kind: v.mu > s ? 'blind' : 'hidden' })
  })
  johariBlind.slice(0, 2).forEach((w) => parItems.push({ label: w, self: 0.12, team: 0.86, kind: 'blind' }))
  const johariHiddenWords = (selfJohari ?? []).filter((w) => !(insights.johari?.counts ?? []).some((c) => c.word === w)).slice(0, 2)
  johariHiddenWords.forEach((w) => parItems.push({ label: w, self: 0.86, team: 0.12, kind: 'hidden' }))
  const parSorted = [...parItems].sort((a, b) => Math.abs(b.team - b.self) - Math.abs(a.team - a.self)).slice(0, 8)
  if (hasSelf && parSorted.length >= 3) {
    cards.splice(cards.length - 1, 0, {
      tone: 'paper',
      node: (
        <div>
          <p className="kicker mb-1 text-pink-deep">
            the whole-self mirror
            <InfoTip text="Every self-vs-team gap on one spine (virtues, Johari, watch-outs). When most gaps lean the same way, your self-image is skewed one consistent direction." />
          </p>
          <h2 className="display mb-4 text-3xl">Which way you tilt</h2>
          <SpineParallax items={parSorted} />
        </div>
      ),
    })
  }

  // The blind-spot constellation: the team's blind flags, clustered by the AI into a root theme.
  const nohariBlindWords = (insights.nohari?.counts ?? []).filter((c) => c.count >= 2).map((c) => c.word).filter((w) => !((sp.nohari as string[] | undefined) ?? []).includes(w))
  const blindStars = Array.from(new Set([...johariBlind, ...nohariBlindWords])).slice(0, 8)
  if (hasSelf && blindStars.length >= 3) {
    cards.splice(cards.length - 1, 0, {
      tone: 'ink',
      node: (
        <div>
          <p className="kicker mb-1 text-blue">
            the blind side
            <InfoTip text="Only the words the team flagged that you didn't own. When several trace to one root, they join into a named constellation — separate blind spots with a single hidden theme." />
          </p>
          <h2 className="display mb-4 text-3xl text-paper-hi">The blind-spot constellation</h2>
          <Constellation words={blindStars} clusters={synthesis?.constellation} />
        </div>
      ),
    })
  }

  // Heat of the moment: composure against rising pressure.
  const compVirtue = insights.virtues.find((v) => v.dimension === 'composure')
  const compSelf = selfVirtues?.composure
  const conflictScen = (insights.scenarios ?? []).find((s) => s.dimension === 'conflict_style')
  const conflictTend = conflictScen ? OPTION_TENDENCY[conflictScen.winner] : undefined
  const heatDir: 'snap' | 'cave' | 'steady' =
    conflictTend === 'excessive' ? 'snap' : conflictTend === 'deficient' ? 'cave' : compVirtue && compVirtue.mu > 5.5 ? 'snap' : compVirtue && compVirtue.mu < 4.5 ? 'cave' : 'steady'
  if (hasSelf && compVirtue && typeof compSelf === 'number' && heatDir !== 'steady') {
    cards.splice(cards.length - 1, 0, {
      tone: 'sand',
      node: (
        <div>
          <p className="kicker mb-1 text-blue-deep">
            behaviour in motion
            <InfoTip text="Composure drawn against rising pressure: the team's line bends toward snapping or caving while your own read stays flat. The two hat chips (Red, Black) name why." />
          </p>
          <h2 className="display mb-4 text-3xl">Heat of the moment</h2>
          <HeatCurve teamComposure={compVirtue.mu} selfComposure={compSelf} direction={heatDir} />
        </div>
      ),
    })
  }

  // Where you'd rather be: team-cast role vs where your energy points.
  const teamW = { thinking: 0, action: 0, people: 0 }
  ;(insights.belbin ?? []).forEach((b) => {
    const cl = BELBIN_ROLES.find((r) => r.key === b.key)?.cluster?.toLowerCase()
    if (cl === 'thinking' || cl === 'action' || cl === 'people') teamW[cl] += b.teamShare
  })
  const energyW = { thinking: 0, action: 0, people: 0 }
  const enTags = sp.energizers as Record<string, number> | undefined
  if (enTags) for (const [id, v] of Object.entries(enTags)) { const cl = ENERGIZER_CLUSTER[id]; if (cl && v > 0) energyW[cl] += v }
  if (hasSelf && teamW.thinking + teamW.action + teamW.people > 0 && energyW.thinking + energyW.action + energyW.people > 0) {
    cards.splice(cards.length - 1, 0, {
      tone: 'paper',
      node: (
        <div>
          <p className="kicker mb-1 text-pink-deep">
            forward motion
            <InfoTip text="Your energy vs the role the team casts you in (the triangle), crossed with what you're strongest at, to name roles and tasks you'd genuinely thrive in." />
          </p>
          <h2 className="display mb-4 text-3xl">Where you'd thrive</h2>
          <RoleTriangle teamW={teamW} energyW={energyW} />
          {synthesis?.greatAt && synthesis.greatAt.length > 0 && (
            <div className="mt-6">
              <p className="kicker mb-3 text-blue-deep">roles &amp; tasks you'd be great at</p>
              <ul className="flex flex-col gap-2.5">
                {synthesis.greatAt.map((g, i) => (
                  <li key={i} className="rounded-2xl border-[2.5px] border-ink bg-sand p-3.5 shadow-chunky-sm">
                    <p className="serif font-black text-ink">★ {g.label}</p>
                    {g.why && <p className="mt-0.5 text-sm leading-snug text-ink-soft">{g.why}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ),
    })
  }

  // A breather, dropped in at the halfway point below: reassure the reader they don't
  // have to hold all of this, because the end pulls it together into a usable summary.
  const reassuranceCard = hasSelf
    ? {
        tone: 'blue' as const,
        node: (
          <div className="flex min-h-[52vh] flex-col justify-center text-paper-hi">
            <div className="text-5xl">🫧</div>
            <p className="kicker mt-4 text-paper-hi/80">take a breath</p>
            <h2 className="display mt-2 text-4xl leading-tight">Feeling like a lot? That's normal.</h2>
            <p className="mt-4 text-lg leading-relaxed text-paper-hi/90">
              You don't have to hold all of this. By the end we pull the whole picture together into{' '}
              <span className="font-black">one clear read</span>, a <span className="font-black">practical action plan</span>, and a
              short summary you can actually keep. Just keep swiping.
            </p>
          </div>
        ),
      }
    : null

  // The through-line: archetype + two driving signals -> the one core tension, as a
  // compact flow. The spine of the report, right before the deep read.
  if (hasSelf && synthesis?.throughLine) {
    const tl = synthesis.throughLine
    cards.push({
      tone: 'sand',
      node: (
        <div>
          <p className="kicker mb-1 text-pink-deep">the through-line</p>
          <h2 className="display mb-6 text-3xl">The one pattern underneath</h2>
          <ThroughLine from={tl.from} via={tl.via} to={tl.to} />
        </div>
      ),
    })
  }

  // The deep "full read" synthesis — the long, cross-referenced portrait that ties
  // every activity together. Bearer-gated, generated with extended thinking. Sits
  // right before the action plan.
  if (hasSelf && (synthesis || synthesisLoading)) {
    const para = (text: string) =>
      text.split('\n\n').filter(Boolean).map((p, i) => (
        <p key={i} className="mt-4 leading-relaxed text-ink first:mt-0">
          <Rich text={p} />
        </p>
      ))
    fullReadIdxRef.current = cards.length
    cards.push({
      tone: 'paper',
      node: synthesis ? (
        <div>
          <p className="kicker mb-1 text-blue-deep">the full read</p>
          <h2 className="display mb-5 text-3xl leading-tight">{synthesis.title}</h2>
          <div className="mb-7 text-[1.05rem]">{para(synthesis.portrait)}</div>
          <div className="flex flex-col gap-4">
            {synthesis.sections.map((s, i) => (
              <div key={i} className="rounded-2xl border-[2.5px] border-ink bg-sand p-5 shadow-chunky-sm">
                <h3 className="serif border-b-2 border-ink/15 pb-2 text-xl font-black text-ink">{s.heading}</h3>
                <div className="mt-2.5">{para(s.body)}</div>
              </div>
            ))}
          </div>
          <button
            onClick={() => copySummary()}
            className="press mt-5 w-full cursor-pointer rounded-2xl border-[2.5px] border-ink bg-ink px-5 py-3 font-display font-black text-paper-hi shadow-chunky-sm"
          >
            {copied ? 'Copied ✓' : 'Copy this read for your AI agent'}
          </button>
          <p className="mt-2 text-center text-xs text-ink-soft">Paste it into your AI assistant so it knows how you work.</p>
        </div>
      ) : (
        <div className="flex min-h-[50vh] flex-col justify-center">
          <p className="kicker mb-1 text-blue-deep">the full read</p>
          <h2 className="display mb-3 text-3xl">Synthesizing everything…</h2>
          <p className="leading-relaxed text-ink-soft">
            Weaving every activity together with your personality and archetype into one read. This one thinks hard, so it takes a few seconds to write, then it appears right here.
          </p>
        </div>
      ),
    })
  }

  // ── The Virtuous Human Score: the bottom line. One 0-100 number for how close to
  // the golden-mean centre (5) the subject lands across the ten virtues and the six
  // thinking hats — the least deviation from centre, the higher the score. The two
  // sources (your read / your team's) and the two activities (virtues / hats) are
  // each weighted equally: we average whichever of the four groups have data, so a
  // team-only report still scores and a self-read simply blends in. ──
  {
    const bal = (v: number) => 1 - Math.abs(Math.min(9, Math.max(1, v)) - 5) / 4
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
    const teamVirtue = mean(insights.virtues.map((v) => bal(v.mu)))
    const teamHat = mean((insights.hats ?? []).filter((h) => h.n > 0).map((h) => bal(h.mu)))
    const selfVirtueVals = selfVirtues
      ? insights.virtues.map((v) => selfVirtues[v.dimension]).filter((n): n is number => typeof n === 'number' && !Number.isNaN(n))
      : []
    const selfHatVals = selfHats
      ? Object.values(selfHats).filter((n): n is number => typeof n === 'number' && !Number.isNaN(n))
      : []
    const selfVirtue = mean(selfVirtueVals.map(bal))
    const selfHat = mean(selfHatVals.map(bal))
    const groups = [teamVirtue, teamHat, selfVirtue, selfHat].filter((g): g is number => g !== null)
    if (groups.length > 0) {
      const score = Math.round((groups.reduce((a, b) => a + b, 0) / groups.length) * 100)
      const to100 = (g: number | null) => (g === null ? null : Math.round(g * 100))
      const rows = [
        { label: 'Ten virtues', team: to100(teamVirtue), self: to100(selfVirtue) },
        { label: 'Thinking hats', team: to100(teamHat), self: to100(selfHat) },
      ].filter((row) => row.team != null || row.self != null)
      // Only surface the population badge when it's a genuine distinction — top
      // quartile or better. (Reading "show if top X%, as long as x is 25 or above,
      // otherwise don't" as "show only when they rank top-25%-or-better"; flip this
      // single constant to change the threshold.)
      const SHOW_TOP_PCT_AT_OR_UNDER = 25
      const showTop = scorePct != null && scorePct <= SHOW_TOP_PCT_AT_OR_UNDER
      cards.push({
        tone: 'sand',
        node: (
          <div className="flex min-h-[60vh] flex-col justify-center">
            <p className="kicker mb-1 text-center text-pink-deep">
              the bottom line
              <InfoTip text="One score for how close to the golden mean you land across the ten virtues and the six thinking hats — your own read blended with your team's. The virtue is the middle; the closer to centre on every scale, the higher the score, out of 100." />
            </p>
            <h2 className="display mb-6 text-center text-3xl">Your virtuous human score</h2>
            <VirtuousHumanScore score={score} topPct={showTop ? scorePct : null} rows={rows} hasSelf={hasSelf} />
            {!hasSelf && (
              <p className="mt-6 text-center text-sm text-ink-soft">
                This is your team's read alone.{' '}
                <button onClick={goSelf} className="cursor-pointer font-bold text-pink-deep underline">
                  Take your self-read
                </button>{' '}
                to blend in your own.
              </p>
            )}
          </div>
        ),
      })
    }
  }

  // Action plan: the practical payoff. 2 to stop / 2 to start now, then 2 more each
  // once those are habit, plus an email-to-self.
  // Prefer the self-aware action plan from the synthesis (it can cite self-vs-team
  // gaps, hats, blind spots); fall back to the team-only one when there's no self-read.
  const ap = (hasSelf && synthesis?.actionPlan) || insights.actionPlan
  if (ap) {
    const bullets = (items: string[]) => (
      <ul className="mt-1 flex flex-col gap-1.5">
        {items.filter(Boolean).map((t, i) => (
          <li key={i} className="flex gap-2 leading-snug text-ink">
            <span className="text-ink/50">•</span>
            <span>
              <Rich text={t} />
            </span>
          </li>
        ))}
      </ul>
    )
    const planText = () => {
      const p = (s: string) => s.replace(/\*\*/g, '')
      const lines = ['My Fishbowl action plan', '', 'STOP NOW']
      ap.stopNow.filter(Boolean).forEach((x) => lines.push(`- ${p(x)}`))
      lines.push('', 'START NOW')
      ap.startNow.filter(Boolean).forEach((x) => lines.push(`- ${p(x)}`))
      lines.push('', 'LATER, once those are habit')
      ap.stopNext.filter(Boolean).forEach((x) => lines.push(`- stop: ${p(x)}`))
      ap.startNext.filter(Boolean).forEach((x) => lines.push(`- start: ${p(x)}`))
      return lines.join('\n')
    }
    const hasNext = ap.stopNext.some(Boolean) || ap.startNext.some(Boolean)
    cards.push({
      tone: 'pink',
      node: (
        <div>
          <p className="kicker mb-1 text-ink/70">your move</p>
          <h2 className="display mb-1 text-3xl text-ink">Start here</h2>
          <p className="mb-5 text-sm text-ink-soft">Tick them off as you go.</p>
          <p className="kicker mb-2 text-pink-deep">3 to stop this week</p>
          <TodoList items={ap.stopNow} tone="stop" />
          <p className="kicker mb-2 mt-5 text-blue-deep">3 to start this week</p>
          <TodoList items={ap.startNow} tone="start" />
          {hasNext && (
            <div className="mt-3 rounded-2xl border-2 border-ink/40 bg-paper-hi/60 p-4">
              <p className="kicker text-ink-soft">then, once those stick</p>
              <p className="kicker mt-1.5 text-pink-deep/80">also stop</p>
              {bullets(ap.stopNext)}
              <p className="kicker mt-3 text-blue-deep/80">also start</p>
              {bullets(ap.startNext)}
            </div>
          )}
          <a
            href={`mailto:?subject=${encodeURIComponent('My Fishbowl action plan')}&body=${encodeURIComponent(planText())}`}
            className="press mt-4 block cursor-pointer rounded-2xl border-[2.5px] border-ink bg-blue px-5 py-3 text-center font-display font-black text-paper-hi shadow-chunky-sm sc-navy"
          >
            Email this plan to me
          </a>
        </div>
      ),
    })
  }

  // Take this to your 1:1: manager talking points so the report gets actioned.
  if (hasSelf && synthesis?.oneOnOne && synthesis.oneOnOne.length > 0) {
    cards.push({
      tone: 'paper',
      node: (
        <div>
          <p className="kicker mb-1 text-blue-deep">
            take it to your 1:1
            <InfoTip text="Bring these to a routine 1:1 with your manager so the gaps this report surfaced actually get worked on, together." />
          </p>
          <h2 className="display mb-1 text-3xl">For your next 1:1</h2>
          <p className="mb-5 text-sm text-ink-soft">Questions to ask, and things to share, so this doesn't just sit in a report.</p>
          <OneOnOne items={synthesis.oneOnOne} />
        </div>
      ),
    })
  }

  // A Post-it of tendencies, blind spots and biases to keep at the back of your mind.
  if (hasSelf && synthesis?.biases && synthesis.biases.length > 0) {
    cards.push({
      tone: 'sand',
      node: (
        <div>
          <p className="kicker mb-1 text-pink-deep">stick it on your monitor</p>
          <h2 className="display mb-4 text-3xl">Keep these in mind</h2>
          <StickyNote bullets={synthesis.biases} />
        </div>
      ),
    })
  }

  // Final "take it with you" card: the whole report compiled as copy-able text to
  // paste into a personal AI assistant as context.
  const buildSummary = () => {
    const plain = (s: string) => (s || '').replace(/\*\*/g, '')
    const L: string[] = []
    L.push(`FISHBOWL REPORT — ${session.creator_name}`)
    L.push(plain(insights.headline))
    if (hasSelf && self?.mbti) L.push(`\nPersonality type: ${self.mbti.nickname} (${self.mbti.fullCode ?? self.mbti.type})`)
    L.push('\nWHERE YOU SHINE')
    insights.topStrengths.forEach((s) => L.push(`- ${s.label}: ${plain(s.blurb)}`))
    L.push('\nTHE TEN VIRTUES (1-9, 5 = the balanced virtue)')
    insights.virtues.forEach((v) => {
      const sv = selfVirtues?.[v.dimension]
      L.push(`- ${v.name}: team ${Math.round(v.mu)}${typeof sv === 'number' ? `, you ${sv}` : ''} (${v.deficientPole} to ${v.excessivePole})`)
    })
    L.push('\nHOW THEY RATE YOU (1-5)')
    insights.competencies.forEach((c) => L.push(`- ${plain(c.statement)}: ${c.average}/5`))
    L.push('\nWHAT THEY APPRECIATE')
    insights.appreciations.forEach((a) => L.push(`- ${plain(a)}`))
    if (teamNohari.length || (selfNohari && selfNohari.length)) {
      L.push('\nWATCH-OUTS (named by 2+ colleagues)')
      teamNohari.forEach((c) => L.push(`- ${c.word} (${c.count} of ${insights.nohari?.n ?? 0})`))
      if (selfNohari && selfNohari.length) L.push(`You own: ${selfNohari.join(', ')}`)
    }
    if (ap) {
      L.push('\nACTION PLAN')
      L.push('Stop now:')
      ap.stopNow.filter(Boolean).forEach((x) => L.push(`- ${plain(x)}`))
      L.push('Start now:')
      ap.startNow.filter(Boolean).forEach((x) => L.push(`- ${plain(x)}`))
      if (ap.stopNext.some(Boolean) || ap.startNext.some(Boolean)) {
        L.push('Later, once those are habit:')
        ap.stopNext.filter(Boolean).forEach((x) => L.push(`- stop: ${plain(x)}`))
        ap.startNext.filter(Boolean).forEach((x) => L.push(`- start: ${plain(x)}`))
      }
    }
    L.push(`\n${plain(insights.closing)}`)
    return L.join('\n')
  }
  // The deep "full read" as plain text, so it can be handed to an AI agent verbatim.
  const synthesisText = (): string => {
    if (!synthesis) return ''
    const plain = (s: string) => (s || '').replace(/\*\*/g, '').replace(/\*/g, '')
    const L: string[] = [`THE FULL READ — ${synthesis.title}`, '', plain(synthesis.portrait)]
    synthesis.sections.forEach((s) => L.push('', s.heading.toUpperCase(), plain(s.body)))
    return L.join('\n')
  }
  // Copy the deep read (when present) plus the structured facts, so the AI agent gets
  // both the narrative and the hard numbers.
  const copySummary = async () => {
    const text = [synthesisText(), buildSummary()].filter(Boolean).join('\n\n──────────\n\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {
      /* clipboard unavailable */
    }
  }
  // Standalone "report, to go" only for users without a self-read (no deep synthesis to
  // copy from). When there's a synthesis, the copy lives on that card instead.
  if (!hasSelf) {
    cards.push({
      tone: 'paper',
      node: (
        <div>
          <p className="kicker mb-1 text-blue-deep">take it with you</p>
          <h2 className="display mb-3 text-3xl">Your report, to go</h2>
          <p className="mb-4 text-sm text-ink-soft">
            Copy the whole report and paste it into your AI assistant as context, so it actually knows how you work.
          </p>
          <div className="max-h-[34vh] overflow-y-auto whitespace-pre-wrap rounded-2xl border-2 border-ink bg-sand p-3 font-mono text-xs leading-relaxed text-ink-soft">
            {buildSummary()}
          </div>
          <button
            onClick={copySummary}
            className="press mt-4 w-full cursor-pointer rounded-2xl border-[2.5px] border-ink bg-blue px-5 py-3 font-display font-black text-paper-hi shadow-chunky-sm sc-navy"
          >
            {copied ? 'Copied ✓' : 'Copy for your AI agent'}
          </button>
        </div>
      ),
    })
  }

  const seenNudge = Boolean(slug && localStorage.getItem(`fishbowl_self_nudge_seen_${slug}`))
  const showEntryModal = selfLoaded && !hasSelf && !modalDismissed && !seenNudge
  const dismissModal = () => {
    setModalDismissed(true)
    if (slug) localStorage.setItem(`fishbowl_self_nudge_seen_${slug}`, '1')
  }

  // Drop the breather in at the halfway mark (not buried near the end).
  if (reassuranceCard) cards.splice(Math.floor(cards.length / 2), 0, reassuranceCard)

  const total = cards.length
  // Clamp for the card we actually render: idx can briefly sit out of range while the
  // deck is still assembling (self/synthesis load in), which would otherwise crash.
  const cur = Math.min(Math.max(idx, 0), total - 1)
  const go = (d: number) => setIdx((i) => Math.min(Math.max(i + d, 0), total - 1))

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-5 py-6">
      {showEntryModal && <EntryModal onTakeNow={goSelf} onLater={dismissModal} />}
      {/* exit (any slide) / back-to-home (last slide), top-right of the deck */}
      <div className="mb-3 flex justify-end">
        {idx < total - 1 ? (
          <button
            onClick={() => navigate('/')}
            aria-label="Exit to home"
            className="press grid h-10 w-10 cursor-pointer place-items-center rounded-full border-[2.5px] border-ink bg-paper-hi text-lg font-black text-ink shadow-chunky-sm"
          >
            ✕
          </button>
        ) : (
          <button
            onClick={() => navigate('/')}
            className="press cursor-pointer rounded-full border-[2.5px] border-ink bg-pink px-5 py-2.5 font-display font-black text-ink shadow-chunky-sm sc-pink"
          >
            Back to home →
          </button>
        )}
      </div>
      {/* dots */}
      <div className="mb-4 flex gap-1.5">
        {cards.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className={`h-2 flex-1 cursor-pointer rounded-full border border-ink ${i <= idx ? 'bg-ink' : 'bg-paper-hi'}`}
          />
        ))}
      </div>

      <div className="flex flex-1 items-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] as const }}
            className="w-full"
          >
            <Card tone={cards[cur].tone} className="max-h-[88vh] overflow-y-auto p-7 sm:p-9">
              {cards[cur].node}
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Disney character standing on the bottom-right of the screen (wide screens only).
          Rendered here, outside the animating card wrapper, so `position: fixed` holds. */}
      {cards[cur].character && (
        <SideCharacter type={cards[cur].character.type} name={cards[cur].character.name} />
      )}

      {/* edge nav — arrows on the screen edges, vertically centered (dots show progress) */}
      {idx > 0 && (
        <button
          onClick={() => go(-1)}
          aria-label="Previous"
          className="press fixed left-2 top-1/2 z-30 grid h-12 w-12 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-[2.5px] border-ink bg-paper-hi text-2xl font-black text-ink shadow-chunky-sm sm:left-5"
        >
          ←
        </button>
      )}
      {idx < total - 1 && (
        <button
          onClick={() => go(1)}
          aria-label="Next"
          className="press fixed right-2 top-1/2 z-30 grid h-12 w-12 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-[2.5px] border-ink bg-pink text-2xl font-black text-ink shadow-chunky-sm sc-pink sm:right-5"
        >
          →
        </button>
      )}
    </div>
  )
}
