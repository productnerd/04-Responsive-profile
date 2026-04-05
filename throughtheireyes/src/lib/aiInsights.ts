import { useCallback, useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'

export type AreaKey =
  | 'first_impressions'
  | 'talents'
  | 'communication'
  | 'emotional_depth'
  | 'reliability'
  | 'blind_spots'
  | 'in_the_group'
  | 'what_they_love'

export interface AiInsights {
  openingSummary: {
    headline: string
    sections: Array<{ area: AreaKey; insight: string }>
  }
  mc: Record<string, { otherSummary: string }>
  freetext: Record<string, { summary: string }>
  advice: Array<{ area: AreaKey; title?: string; action: string[] | string }>
}

interface State {
  insights: AiInsights | null
  cachedAt: number | null // response_count at the time the cache was generated
  loading: boolean // initial cache read in progress
  regenerating: boolean // user clicked Regenerate
  error: string | null
}

interface UseAiInsightsResult extends State {
  isStale: boolean
  regenerate: () => Promise<void>
}

// IMPORTANT: this hook READS from tte_ai_insights only. It never triggers
// Claude from the browser. Generation happens in the background: the DB
// trigger tte_sessions_ai_insights_trigger fires the edge function the
// instant response_count crosses from <5 to >=5, so by the time the creator
// visits the report it has already been written to tte_ai_insights.
//
// The only exception is the regenerate() callback, which the user must
// explicitly click when new responses have landed since the cached report.
export function useAiInsights(
  sessionId: string | undefined,
  currentResponseCount: number | undefined,
  ready: boolean
): UseAiInsightsResult {
  const [state, setState] = useState<State>({
    insights: null,
    cachedAt: null,
    loading: false,
    regenerating: false,
    error: null,
  })

  useEffect(() => {
    if (!sessionId || !ready || !isSupabaseConfigured()) return

    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))

    const run = async () => {
      const { data: cached, error } = await supabase
        .from('tte_ai_insights')
        .select('insights, response_count_at_generation')
        .eq('session_id', sessionId)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        setState({
          insights: null,
          cachedAt: null,
          loading: false,
          regenerating: false,
          error: error.message,
        })
        return
      }

      if (cached?.insights) {
        setState({
          insights: cached.insights as AiInsights,
          cachedAt: cached.response_count_at_generation ?? null,
          loading: false,
          regenerating: false,
          error: null,
        })
        return
      }

      // No cache row yet. The DB trigger should have created one at the
      // 5-response threshold. If we land here, generation is still in flight
      // or the trigger has not been deployed. Surface a static "not ready"
      // state. No in-browser generation, ever.
      setState({
        insights: null,
        cachedAt: null,
        loading: false,
        regenerating: false,
        error: null,
      })
    }

    run()
    return () => {
      cancelled = true
    }
  }, [sessionId, ready])

  const regenerate = useCallback(async () => {
    if (!sessionId || !isSupabaseConfigured()) return
    setState((s) => ({ ...s, regenerating: true, error: null }))
    try {
      const { data, error } = await supabase.functions.invoke('tte-ai-insights', {
        body: { session_id: sessionId, force: true },
      })
      if (error) {
        setState((s) => ({ ...s, regenerating: false, error: error.message }))
        return
      }
      if (!data?.insights) {
        setState((s) => ({ ...s, regenerating: false, error: 'No insights returned' }))
        return
      }

      // Re-read the stored row so the UI always reflects persisted state.
      const { data: stored, error: storedErr } = await supabase
        .from('tte_ai_insights')
        .select('insights, response_count_at_generation')
        .eq('session_id', sessionId)
        .maybeSingle()

      if (storedErr || !stored?.insights) {
        setState((s) => ({
          ...s,
          regenerating: false,
          error: 'Report was generated but could not be stored. Please try again.',
        }))
        return
      }

      setState({
        insights: stored.insights as AiInsights,
        cachedAt: stored.response_count_at_generation,
        loading: false,
        regenerating: false,
        error: null,
      })
    } catch (e) {
      setState((s) => ({ ...s, regenerating: false, error: String(e) }))
    }
  }, [sessionId])

  const isStale =
    state.insights !== null &&
    state.cachedAt !== null &&
    typeof currentResponseCount === 'number' &&
    currentResponseCount > state.cachedAt

  return { ...state, isStale, regenerate }
}
