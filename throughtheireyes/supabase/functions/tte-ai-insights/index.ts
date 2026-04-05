// Supabase Edge Function: tte-ai-insights
// Synthesizes AI-generated insights from a session's responses using Claude.
//
// Deploy:
//   supabase functions deploy tte-ai-insights --project-ref knftyqkhampkqchoncel
//
// Required secrets (set via Supabase dashboard → Edge Functions → Secrets,
// or `supabase secrets set --project-ref knftyqkhampkqchoncel ANTHROPIC_API_KEY=...`):
//   - ANTHROPIC_API_KEY
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected.)
//
// Prompts live in the repo at throughtheireyes/prompts/tte-ai-insights.json and
// are fetched from GitHub raw at request time (30s in-memory cache). Editing
// that JSON file and pushing is enough to change the prompt, no redeploy.
// Optional secret PROMPTS_URL overrides the source.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

// ─── Prompt loader ──────────────────────────────────────────────────────────
// Defaults to the current working branch. Override via PROMPTS_URL secret in
// Supabase if you move to a different branch (e.g. after merging to main).
const DEFAULT_PROMPTS_URL =
  'https://raw.githubusercontent.com/productnerd/04-Responsive-profile/claude/feedback-webapp-setup-l0x8F/throughtheireyes/prompts/tte-ai-insights.json'

interface PromptConfig {
  model: string
  maxTokens: number
  systemPrompt: string
  userPromptTemplate: string
}

// Hardcoded fallback used only if the remote fetch fails. Kept minimal and
// just enough to produce valid output if GitHub is unreachable.
const FALLBACK_PROMPTS: PromptConfig = {
  model: 'claude-opus-4-6',
  maxTokens: 8000,
  systemPrompt:
    'You are an analyst for "Through Their Eyes". Anonymous friends answered 25 questions about {{name}}. Speak to {{name}} in second person. Warm, brief, no em dashes. Bold 2-4 key phrases per string. Areas:\n{{areaBlock}}\nReturn JSON with openingSummary (headline, sections for all 8 areas), mc, freetext, and advice (8 entries, each with area and action array of exactly 2 standalone bullets, max 18 words each, at least one **bold** phrase each).',
  userPromptTemplate:
    '# Questions\n{{qBlock}}\n\n# Responses (n={{responseCount}})\n{{answerBlock}}\n\n# Other IDs: {{mcList}}\n\nReturn JSON now.',
}

let cachedPrompts: { config: PromptConfig; fetchedAt: number } | null = null
const PROMPT_CACHE_MS = 30_000 // 30s, long enough to batch burst calls, short enough for fast iteration

async function loadPrompts(): Promise<PromptConfig> {
  const now = Date.now()
  if (cachedPrompts && now - cachedPrompts.fetchedAt < PROMPT_CACHE_MS) {
    return cachedPrompts.config
  }
  const url = Deno.env.get('PROMPTS_URL') || DEFAULT_PROMPTS_URL
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`prompts fetch ${res.status}`)
    const json = (await res.json()) as PromptConfig
    if (!json.systemPrompt || !json.userPromptTemplate) throw new Error('invalid prompts json')
    cachedPrompts = { config: json, fetchedAt: now }
    return json
  } catch (e) {
    console.error('prompt fetch failed, using fallback:', e)
    return FALLBACK_PROMPTS
  }
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : `{{${key}}}`
  )
}

type QType = 'mc' | 'rating' | 'freetext'
interface Q {
  id: number
  type: QType
  text: string
  options?: string[]
}

// Must mirror src/data/questions.ts
const QUESTIONS: Q[] = [
  { id: 1, type: 'mc', text: 'When you first met {name}, what did you assume about them that turned out to be wrong?', options: ['That they were confident', 'That they were shy', 'That they were serious', 'That they were easygoing', "That they didn't care", 'That they had it all figured out'] },
  { id: 2, type: 'mc', text: 'The vibe {name} gives off in the first 5 minutes is…', options: ['Warm & welcoming', 'Cool & mysterious', 'High-energy & fun', 'Nervous & endearing', 'Intense & magnetic', 'Chill & unbothered'] },
  { id: 3, type: 'freetext', text: "What's a first impression of {name} that completely changed once you got to know them?" },
  { id: 4, type: 'mc', text: "What is {name}'s most underrated skill?", options: ['Reading people', 'Explaining complex things simply', 'Making hard decisions', 'Staying calm in chaos', 'Connecting people together', 'Turning ideas into action'] },
  { id: 5, type: 'freetext', text: "What's something {name} is naturally talented at that they probably undervalue or don't even notice?" },
  { id: 6, type: 'rating', text: "How much do you trust {name}'s judgment when it matters?" },
  { id: 7, type: 'rating', text: 'How well does {name} actually listen (vs. waiting for their turn to talk)?' },
  { id: 8, type: 'rating', text: 'How comfortable do you feel telling {name} something difficult or honest?' },
  { id: 9, type: 'mc', text: 'In a disagreement, {name} tends to…', options: ['Shut down and go quiet', 'Get defensive', 'Try to understand the other side', 'Argue to win', 'Over-explain their position', 'Avoid the disagreement entirely'] },
  { id: 10, type: 'freetext', text: "What's one thing {name} does in conversation that either makes you feel really heard — or really unheard?" },
  { id: 11, type: 'mc', text: "When you're going through something hard, {name} is the kind of friend who…", options: ['Gives tough love', 'Listens without trying to fix', 'Sends memes to cheer you up', 'Checks in days later to follow up', "Doesn't really notice", 'Shows up physically'] },
  { id: 12, type: 'mc', text: 'The emotion {name} probably struggles to express the most is…', options: ['Anger', 'Sadness', 'Vulnerability', 'Joy/excitement', 'Gratitude', 'Fear'] },
  { id: 13, type: 'rating', text: 'How good is {name} at reading the room / picking up on how people feel?' },
  { id: 14, type: 'rating', text: 'How consistent is {name}?' },
  { id: 15, type: 'mc', text: 'Where does {name} sometimes let people down?', options: ['Being flaky with plans', 'Not responding to messages', 'Overpromising', 'Being emotionally unavailable', 'Forgetting important things', 'They rarely let people down'] },
  { id: 16, type: 'mc', text: "What's {name}'s biggest blind spot?", options: ["They don't see how much they matter to people", 'They underestimate themselves', 'They overestimate how okay they seem', "They don't realize when they're being closed off", 'They miss how their mood affects others', "They don't see their own patterns"] },
  { id: 17, type: 'mc', text: 'If {name} invested in ONE area of personal growth, it should be…', options: ['Setting boundaries', 'Being more vulnerable', 'Thinking before reacting', 'Letting go of control', 'Asking for help', 'Finishing what they start'] },
  { id: 18, type: 'freetext', text: "What's a pattern you've noticed in {name} that they might not see themselves?" },
  { id: 19, type: 'freetext', text: 'If you could sit {name} down and tell them one hard truth with love, what would it be?' },
  { id: 20, type: 'mc', text: 'In a friend group, {name} naturally becomes the…', options: ['Leader/organizer', 'Emotional glue', 'Entertainer', 'Quiet observer', "Devil's advocate", 'Peacemaker'] },
  { id: 21, type: 'mc', text: "What would the friend group lose if {name} wasn't in it?", options: ['The deep conversations', 'The spontaneity', 'The emotional safety', 'The laughter', 'The honesty', 'The plans actually happening'] },
  { id: 22, type: 'mc', text: "What's {name}'s most annoying habit?", options: ['Overthinking everything', 'Being chronically late', 'Interrupting', 'Giving unsolicited advice', 'Being on their phone too much', 'Saying "I\'m fine" when they\'re clearly not'] },
  { id: 23, type: 'freetext', text: 'What do you genuinely appreciate most about having {name} in your life?' },
  { id: 24, type: 'freetext', text: 'What makes {name} irreplaceable? What would be impossible to find in someone else?' },
  { id: 25, type: 'freetext', text: 'If {name} could only read one message from this entire questionnaire, what would you want them to know?' },
]

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))
    const session_id: string | undefined = body.session_id
    const force: boolean = !!body.force

    if (!session_id) {
      return new Response(JSON.stringify({ error: 'session_id required' }), { status: 400, headers: jsonHeaders })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Fetch session
    const { data: session, error: sessionErr } = await supabase
      .from('tte_sessions')
      .select('id, creator_name, response_count')
      .eq('id', session_id)
      .single()
    if (sessionErr || !session) {
      return new Response(JSON.stringify({ error: 'session not found' }), { status: 404, headers: jsonHeaders })
    }
    if ((session.response_count || 0) < 5) {
      return new Response(JSON.stringify({ error: 'not enough responses' }), { status: 403, headers: jsonHeaders })
    }

    // 2. Check cache
    if (!force) {
      const { data: cached } = await supabase
        .from('tte_ai_insights')
        .select('insights, response_count_at_generation')
        .eq('session_id', session_id)
        .maybeSingle()
      if (cached && cached.response_count_at_generation === session.response_count) {
        return new Response(
          JSON.stringify({
            insights: cached.insights,
            response_count_at_generation: cached.response_count_at_generation,
            cached: true,
          }),
          { headers: jsonHeaders }
        )
      }
    }

    // 3. Fetch all responses
    const { data: responses, error: respErr } = await supabase
      .from('tte_responses')
      .select('answers')
      .eq('session_id', session_id)
    if (respErr || !responses || responses.length === 0) {
      return new Response(JSON.stringify({ error: 'no responses' }), { status: 404, headers: jsonHeaders })
    }

    // 4. Build prompt
    const name = session.creator_name

    const qBlock = QUESTIONS.map((q) => {
      let s = `Q${q.id} [${q.type}]: ${q.text.replace(/\{name\}/g, name)}`
      if (q.options?.length) s += `\n  Canonical options: ${q.options.map((o) => `"${o}"`).join(', ')}`
      return s
    }).join('\n\n')

    const answerBlock = responses
      .map((r: any, i: number) => {
        const lines = QUESTIONS.map((q) => {
          const v = r.answers?.[q.id] ?? r.answers?.[String(q.id)]
          if (v === undefined || v === null || v === '') return `  Q${q.id}: (skipped)`
          return `  Q${q.id}: ${v}`
        }).join('\n')
        return `--- Respondent ${i + 1} ---\n${lines}`
      })
      .join('\n\n')

    // Identify MC questions that had at least one "Other" entry
    const mcWithOther: number[] = []
    for (const q of QUESTIONS) {
      if (q.type !== 'mc' || !q.options) continue
      const hasOther = responses.some((r: any) => {
        const v = r.answers?.[q.id] ?? r.answers?.[String(q.id)]
        return typeof v === 'string' && v !== '' && !q.options!.includes(v)
      })
      if (hasOther) mcWithOther.push(q.id)
    }

    const AREAS = [
      { key: 'first_impressions', label: 'First Impressions', questions: '1, 2, 3' },
      { key: 'talents', label: 'Talents & Superpowers', questions: '4, 5' },
      { key: 'communication', label: 'Communication & Listening', questions: '7, 8, 10' },
      { key: 'emotional_depth', label: 'Emotional Depth', questions: '11, 12, 13' },
      { key: 'reliability', label: 'Reliability & Trust', questions: '6, 14, 15' },
      { key: 'blind_spots', label: 'Blind Spots & Growth', questions: '9, 16, 17, 18, 19' },
      { key: 'in_the_group', label: 'In the Group', questions: '20, 21, 22' },
      { key: 'what_they_love', label: 'What They Love About You', questions: '23, 24, 25' },
    ]

    const areaBlock = AREAS.map((a) => `- ${a.key} ("${a.label}"), questions ${a.questions}`).join('\n')

    // Load prompts from the repo (GitHub raw) with in-memory caching + fallback.
    // Edit throughtheireyes/prompts/tte-ai-insights.json and push to update.
    const promptConfig = await loadPrompts()

    const vars: Record<string, string> = {
      name,
      areaBlock,
      qBlock,
      answerBlock,
      responseCount: String(responses.length),
      mcList: mcWithOther.length ? mcWithOther.join(', ') : '(none, return "mc": {})',
    }

    const systemPrompt = interpolate(promptConfig.systemPrompt, vars)
    const userPrompt = interpolate(promptConfig.userPromptTemplate, vars)

    // 5. Call Claude
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), { status: 500, headers: jsonHeaders })
    }

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: promptConfig.model,
        max_tokens: promptConfig.maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!claudeRes.ok) {
      const errText = await claudeRes.text()
      return new Response(JSON.stringify({ error: 'claude api error', status: claudeRes.status, details: errText }), { status: 502, headers: jsonHeaders })
    }

    const claudeJson = await claudeRes.json()
    const textBlock = Array.isArray(claudeJson.content)
      ? claudeJson.content.find((b: any) => b.type === 'text')
      : null
    const rawText: string = textBlock?.text || ''
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    let insights: any
    try {
      insights = JSON.parse(cleaned)
    } catch {
      return new Response(
        JSON.stringify({ error: 'failed to parse claude response as JSON', raw: rawText }),
        { status: 502, headers: jsonHeaders }
      )
    }

    // Hard guarantee: strip em/en dashes from every string value in the JSON tree.
    // The prompt asks for this, but we enforce it deterministically so the user
    // never sees a dash slip through regardless of what the model does.
    const stripDashes = (s: string): string =>
      s
        // em/en dash surrounded by optional spaces → comma + space
        .replace(/\s*[—–]\s*/g, ', ')
        // collapse any accidental ", ," or "  " artifacts
        .replace(/,\s*,/g, ',')
        .replace(/\s{2,}/g, ' ')
        .trim()

    const scrub = (node: any): any => {
      if (typeof node === 'string') return stripDashes(node)
      if (Array.isArray(node)) return node.map(scrub)
      if (node && typeof node === 'object') {
        const out: Record<string, any> = {}
        for (const k of Object.keys(node)) out[k] = scrub(node[k])
        return out
      }
      return node
    }
    insights = scrub(insights)

    // Enforce advice bullet shape deterministically. If the model returned a
    // single long string, or one giant bullet, or three bullets, we normalise
    // to exactly 2 bullets per action, each trimmed to a sentence.
    const toBullets = (val: unknown): string[] => {
      let bullets: string[] = []
      if (Array.isArray(val)) bullets = val.filter((x) => typeof x === 'string') as string[]
      else if (typeof val === 'string') bullets = [val]

      // If any bullet is a multi-sentence monster, split on sentence boundaries
      const exploded: string[] = []
      for (const b of bullets) {
        const parts = b
          .split(/(?<=[.!?])\s+/)
          .map((s) => s.trim())
          .filter(Boolean)
        if (parts.length >= 2) exploded.push(...parts)
        else exploded.push(b.trim())
      }

      // Keep first 2, pad if needed so the UI always renders 2 bullets
      let result = exploded.filter(Boolean).slice(0, 2)
      if (result.length === 1) {
        // Try splitting the single bullet on commas if it's long
        const commaParts = result[0].split(/,\s+/).map((s) => s.trim()).filter(Boolean)
        if (commaParts.length >= 2) result = [commaParts[0] + '.', commaParts.slice(1).join(', ') + '.']
      }
      if (result.length === 0) result = ['', '']
      if (result.length === 1) result.push('')
      return result
    }

    if (Array.isArray(insights?.advice)) {
      insights.advice = insights.advice.map((a: any) => ({
        ...a,
        action: toBullets(a?.action),
      }))
    }

    // 6. Upsert cache. This MUST succeed — every generated report has to be
    // persisted so subsequent page loads retrieve the stored version instead
    // of regenerating. If the write fails, surface the error loudly so the
    // client can retry rather than showing a "ghost" report that's in memory
    // only.
    const response_count_at_generation = session.response_count
    const { error: upsertErr } = await supabase
      .from('tte_ai_insights')
      .upsert({
        session_id,
        insights,
        response_count_at_generation,
        updated_at: new Date().toISOString(),
      })

    if (upsertErr) {
      console.error('cache upsert failed:', upsertErr)
      return new Response(
        JSON.stringify({ error: 'failed to persist insights', details: upsertErr.message }),
        { status: 500, headers: jsonHeaders }
      )
    }

    return new Response(
      JSON.stringify({ insights, response_count_at_generation, cached: false }),
      { headers: jsonHeaders }
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: jsonHeaders })
  }
})
