export type QuestionType = 'mc' | 'rating' | 'freetext'

export type QuestionCategory =
  | 'first_impressions'
  | 'strengths'
  | 'communication'
  | 'emotional_intelligence'
  | 'reliability'
  | 'growth'
  | 'social'
  | 'habits'
  | 'appreciation'
  | 'final'

export interface Question {
  id: number
  category: QuestionCategory
  type: QuestionType
  text: string
  options?: string[]
  section: string
  sectionDescription: string
  lowLabel?: string
  highLabel?: string
  allowOther?: boolean
}

export interface Session {
  id: string
  creator_name: string
  slug: string
  created_at: string
  response_count: number
}

export interface Response {
  id: string
  session_id: string
  answers: Record<number, string | number>
  completed_at: string
}

export interface AggregatedResults {
  totalResponses: number
  creatorName: string
  mcResults: Record<number, { counts: Record<string, number>; winner: string; winnerCount: number }>
  ratingResults: Record<number, { average: number; scores: number[] }>
  freetextResults: Record<number, string[]>
}
