import type { AggregatedResults } from '../types'
import { questions } from '../data/questions'

export function aggregateResponses(
  responses: Array<{ answers: Record<number, string | number> }>,
  creatorName: string
): AggregatedResults {
  const mcResults: AggregatedResults['mcResults'] = {}
  const ratingResults: AggregatedResults['ratingResults'] = {}
  const freetextResults: AggregatedResults['freetextResults'] = {}

  for (const q of questions) {
    if (q.type === 'mc') {
      const counts: Record<string, number> = {}
      for (const r of responses) {
        const val = r.answers[q.id] as string
        if (val) counts[val] = (counts[val] || 0) + 1
      }
      const winner = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
      mcResults[q.id] = {
        counts,
        winner: winner?.[0] || '',
        winnerCount: winner?.[1] || 0,
      }
    } else if (q.type === 'rating') {
      const scores: number[] = []
      for (const r of responses) {
        const val = r.answers[q.id] as number
        if (val) scores.push(val)
      }
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
      ratingResults[q.id] = { average: Math.round(avg * 10) / 10, scores }
    } else if (q.type === 'freetext') {
      const texts: string[] = []
      for (const r of responses) {
        const val = r.answers[q.id] as string
        if (val && val.trim()) texts.push(val.trim())
      }
      freetextResults[q.id] = texts
    }
  }

  return {
    totalResponses: responses.length,
    creatorName,
    mcResults,
    ratingResults,
    freetextResults,
  }
}

// Helper to get a percentage for a specific MC answer
export function mcPercentage(result: AggregatedResults['mcResults'][number], option: string): number {
  const total = Object.values(result.counts).reduce((a, b) => a + b, 0)
  if (total === 0) return 0
  return Math.round(((result.counts[option] || 0) / total) * 100)
}

// Get top N MC answers sorted by count
export function topMcAnswers(result: AggregatedResults['mcResults'][number], n = 3): Array<{ option: string; count: number; pct: number }> {
  const total = Object.values(result.counts).reduce((a, b) => a + b, 0)
  return Object.entries(result.counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([option, count]) => ({
      option,
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
}
