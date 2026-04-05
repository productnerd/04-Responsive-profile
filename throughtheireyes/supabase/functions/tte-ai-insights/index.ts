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

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

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

    const areaBlock = AREAS.map((a) => `- ${a.key} ("${a.label}") — questions ${a.questions}`).join('\n')

    const systemPrompt = `You are an insightful analyst for a feedback app called "Through Their Eyes". Anonymous friends have answered 25 questions about a person named ${name}. Your job is to synthesize the results into warm, specific, cross-referenced insights that ${name} will read about themselves.

=== VOICE & TONE (applies to EVERY string you write) ===
Speak TO ${name} in second person ("you", "your"). Never use their name. Never use third-person pronouns about them.
Tone: warm, friendly, nurturing, mature, optimistic, down to earth, easy going. Like a wise, kind friend who read everything carefully.
Never sycophantic. Never clinical. Never preachy. No throat-clearing. No "it's important to note". No filler.
Be brief and scannable. Short sentences. Ground every claim in what respondents actually wrote.
Look ACROSS questions for patterns (e.g. if "underestimates themselves" shows up in blind spots AND hidden talents AND final message, name that).

=== ABSOLUTE BAN ON DASHES ===
NEVER type the character "—" (U+2014 em dash).
NEVER type the character "–" (U+2013 en dash).
NEVER type " - " as a sentence connector (use commas, periods, colons, semicolons, or parentheses).
This is the single most important rule. Every single string you emit will be scanned for these characters. A single em dash invalidates the entire response. Use commas and periods.

=== BOLD MARKDOWN ===
In every "insight", "summary", "otherSummary", and every advice bullet, wrap 2 to 4 of the most scannable key phrases in markdown bold using **double asterisks**. Choose punchy verbs and nouns, not filler words. Do NOT bold full sentences. Bold sparingly so the bolded words alone tell the gist.
The "headline" field must NOT contain bold.
The "title" field (inside advice) must NOT contain bold.

=== AREAS (use these exact keys) ===
${areaBlock}

=== ADVICE BULLETS (critical, read carefully) ===
Every "action" MUST be a JSON array of EXACTLY 2 bullet strings. Not 1. Not 3. EXACTLY 2.
There is NO title, NO summary, NO heading above the bullets. Only the area label (e.g. "First Impressions") appears above them. That means EACH BULLET MUST BE COMPLETELY SELF-CONTAINED and make full sense on its own without the other bullet and without any title.
Each bullet is ONE complete, standalone piece of advice. A reader should be able to read just that one bullet and understand exactly what to do and why.
Each bullet MUST be max 18 words. Count them.
Each bullet MUST contain at least one **bold** segment on the key verb or phrase.
The two bullets must be TWO DIFFERENT pieces of advice, not two halves of the same idea. Think: two separate tips a friend would give you about this area. Not "tip + elaboration".
Every bullet must include both the WHAT (the action) and enough context that the reader immediately knows why it matters, in that single sentence.

GOOD example (each bullet stands alone, makes full sense by itself):
"action": [
  "When someone compliments you, say **thank you** and stop talking. No joke, no deflection.",
  "Notice the **urge to shrink** when praised. That discomfort is the exact work."
]

BAD example (bullets depend on each other or on a title to make sense):
"action": [
  "Your warmth surprises people.",
  "Show it earlier in new settings."
]
(Bullet 1 is an observation, not advice. Bullet 2 only makes sense after bullet 1. Neither stands alone.)

BAD example (one idea split in half, em dash):
"action": [
  "Your friends say you deflect every compliment with a joke — try saying thank you this week",
  "That discomfort is the exact growth edge, so sit with it instead of redirecting"
]

=== OUTPUT FORMAT ===
Return ONLY valid JSON, no surrounding commentary, no code fences. String values MAY contain **bold** markdown but no other markdown. Shape:
{
  "openingSummary": {
    "headline": "One punchy line, max 12 words, capturing the meta-finding that jumps out across all 25 answers. No bold. No dashes.",
    "sections": [
      { "area": "first_impressions", "insight": "2 to 3 sentences synthesizing this area. Specific and warm. 2 to 4 **bold** phrases. No dashes." },
      { "area": "talents", "insight": "..." },
      { "area": "communication", "insight": "..." },
      { "area": "emotional_depth", "insight": "..." },
      { "area": "reliability", "insight": "..." },
      { "area": "blind_spots", "insight": "..." },
      { "area": "in_the_group", "insight": "..." },
      { "area": "what_they_love", "insight": "..." }
    ]
  },
  "mc": {
    "<questionId>": { "otherSummary": "2 to 3 sentences on what the 'Other' respondents added, whether they cluster around a theme, how that compares to the canonical winners. No dashes." }
  },
  "freetext": {
    "<questionId>": { "summary": "2 to 4 sentence synthesis. What people agree on, what is unexpected, what resonates with other questions. Specific, quotable, short. No dashes." }
  },
  "advice": [
    {
      "area": "first_impressions",
      "action": [
        "First standalone tip. Complete advice in one sentence. Max 18 words. One **bold** phrase. No dashes.",
        "Second standalone tip. Different angle, independently complete. Max 18 words. One **bold** phrase. No dashes."
      ]
    },
    { "area": "talents", "action": ["...", "..."] },
    { "area": "communication", "action": ["...", "..."] },
    { "area": "emotional_depth", "action": ["...", "..."] },
    { "area": "reliability", "action": ["...", "..."] },
    { "area": "blind_spots", "action": ["...", "..."] },
    { "area": "in_the_group", "action": ["...", "..."] },
    { "area": "what_they_love", "action": ["...", "..."] }
  ]
}

"openingSummary.sections" MUST contain all 8 areas in the order above. "advice" MUST contain all 8 areas in the order above, with NO "title" field. Every "action" MUST be an array of exactly 2 bullet strings. Each bullet MUST be a self-contained piece of advice (understandable alone, no dependency on the other bullet), under 18 words, with at least one **bold** segment. Only include "mc" entries for the question IDs listed as having Other answers. Include every freetext question in "freetext".`

    const userPrompt = `# The 25 Questions\n\n${qBlock}\n\n# Anonymous Responses (n=${responses.length})\n\n${answerBlock}\n\n# Questions with "Other" free-text answers\n\nOnly include these IDs in the "mc" object: ${mcWithOther.length ? mcWithOther.join(', ') : '(none — return "mc": {})'}\n\nAll freetext question IDs to cover: 3, 5, 10, 18, 19, 23, 24, 25\n\nReturn the JSON now.`

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
        model: 'claude-opus-4-6',
        max_tokens: 8000,
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
