import type { Question } from '../types'

// 25 questions, ~5 minutes.
// Curated from a longer list — duplicates removed, only the most practically
// useful self-knowledge questions kept. Mix: 12 MC + 5 Rating + 8 Freetext.
export const questions: Question[] = [
  // ─── SECTION 1: First Impressions (Q1–3) ───
  {
    id: 1,
    category: 'first_impressions',
    type: 'mc',
    section: 'First Impressions',
    sectionDescription: 'How {name} lands on people before they know them well.',
    text: 'When you first met {name}, what did you assume about them that turned out to be wrong?',
    options: ['That they were confident', 'That they were shy', 'That they were serious', 'That they were easygoing', "That they didn't care", 'That they had it all figured out'],
    allowOther: true,
  },
  {
    id: 2,
    category: 'first_impressions',
    type: 'mc',
    section: 'First Impressions',
    sectionDescription: 'How {name} lands on people before they know them well.',
    text: 'The vibe {name} gives off in the first 5 minutes is…',
    options: ['Warm & welcoming', 'Cool & mysterious', 'High-energy & fun', 'Nervous & endearing', 'Intense & magnetic', 'Chill & unbothered'],
    allowOther: true,
  },
  {
    id: 3,
    category: 'first_impressions',
    type: 'freetext',
    section: 'First Impressions',
    sectionDescription: 'How {name} lands on people before they know them well.',
    text: "What's a first impression of {name} that completely changed once you got to know them?",
  },

  // ─── SECTION 2: Core Strengths & Talents (Q4–6) ───
  {
    id: 4,
    category: 'strengths',
    type: 'mc',
    section: 'Core Strengths',
    sectionDescription: "What {name} is actually great at — especially the things they can't see.",
    text: "What is {name}'s most underrated skill?",
    options: ['Reading people', 'Explaining complex things simply', 'Making hard decisions', 'Staying calm in chaos', 'Connecting people together', 'Turning ideas into action'],
    allowOther: true,
  },
  {
    id: 5,
    category: 'strengths',
    type: 'freetext',
    section: 'Core Strengths',
    sectionDescription: "What {name} is actually great at — especially the things they can't see.",
    text: "What's something {name} is naturally talented at that they probably undervalue or don't even notice?",
  },
  {
    id: 6,
    category: 'strengths',
    type: 'rating',
    section: 'Core Strengths',
    sectionDescription: "What {name} is actually great at — especially the things they can't see.",
    text: "How much do you trust {name}'s judgment when it matters?",
  },

  // ─── SECTION 3: Communication (Q7–10) ───
  {
    id: 7,
    category: 'communication',
    type: 'rating',
    section: 'Communication',
    sectionDescription: 'How {name} talks, listens, and makes people feel in conversation.',
    text: 'How well does {name} actually listen (vs. waiting for their turn to talk)?',
  },
  {
    id: 8,
    category: 'communication',
    type: 'rating',
    section: 'Communication',
    sectionDescription: 'How {name} talks, listens, and makes people feel in conversation.',
    text: 'How comfortable do you feel telling {name} something difficult or honest?',
  },
  {
    id: 9,
    category: 'communication',
    type: 'mc',
    section: 'Communication',
    sectionDescription: 'How {name} talks, listens, and makes people feel in conversation.',
    text: 'In a disagreement, {name} tends to…',
    options: ['Shut down and go quiet', 'Get defensive', 'Try to understand the other side', 'Argue to win', 'Over-explain their position', 'Avoid the disagreement entirely'],
    allowOther: true,
  },
  {
    id: 10,
    category: 'communication',
    type: 'freetext',
    section: 'Communication',
    sectionDescription: 'How {name} talks, listens, and makes people feel in conversation.',
    text: "What's one thing {name} does in conversation that either makes you feel really heard — or really unheard?",
  },

  // ─── SECTION 4: Emotional Intelligence & Depth (Q11–13) ───
  {
    id: 11,
    category: 'emotional_intelligence',
    type: 'mc',
    section: 'Emotional Depth',
    sectionDescription: "How {name} navigates feelings — theirs and others'.",
    text: "When you're going through something hard, {name} is the kind of friend who…",
    options: ['Gives tough love', 'Listens without trying to fix', 'Sends memes to cheer you up', 'Checks in days later to follow up', "Doesn't really notice", 'Shows up physically'],
    allowOther: true,
  },
  {
    id: 12,
    category: 'emotional_intelligence',
    type: 'mc',
    section: 'Emotional Depth',
    sectionDescription: "How {name} navigates feelings — theirs and others'.",
    text: 'The emotion {name} probably struggles to express the most is…',
    options: ['Anger', 'Sadness', 'Vulnerability', 'Joy/excitement', 'Gratitude', 'Fear'],
    allowOther: true,
  },
  {
    id: 13,
    category: 'emotional_intelligence',
    type: 'rating',
    section: 'Emotional Depth',
    sectionDescription: "How {name} navigates feelings — theirs and others'.",
    text: 'How good is {name} at reading the room / picking up on how people feel?',
  },

  // ─── SECTION 5: Reliability (Q14–15) ───
  {
    id: 14,
    category: 'reliability',
    type: 'rating',
    section: 'Reliability',
    sectionDescription: 'Can people count on {name}? Do they?',
    text: 'How consistent is {name}?',
    lowLabel: 'Hot and cold',
    highLabel: 'Rock solid',
  },
  {
    id: 15,
    category: 'reliability',
    type: 'mc',
    section: 'Reliability',
    sectionDescription: 'Can people count on {name}? Do they?',
    text: 'Where does {name} sometimes let people down?',
    options: ['Being flaky with plans', 'Not responding to messages', 'Overpromising', 'Being emotionally unavailable', 'Forgetting important things', 'They rarely let people down'],
    allowOther: true,
  },

  // ─── SECTION 6: Growth Edges & Blind Spots (Q16–19) ───
  {
    id: 16,
    category: 'growth',
    type: 'mc',
    section: 'Growth Edges & Blind Spots',
    sectionDescription: "The stuff {name} can't see about themselves. This is the gold.",
    text: "What's {name}'s biggest blind spot?",
    options: ["They don't see how much they matter to people", 'They underestimate themselves', 'They overestimate how okay they seem', "They don't realize when they're being closed off", 'They miss how their mood affects others', "They don't see their own patterns"],
    allowOther: true,
  },
  {
    id: 17,
    category: 'growth',
    type: 'mc',
    section: 'Growth Edges & Blind Spots',
    sectionDescription: "The stuff {name} can't see about themselves. This is the gold.",
    text: 'If {name} invested in ONE area of personal growth, it should be…',
    options: ['Setting boundaries', 'Being more vulnerable', 'Thinking before reacting', 'Letting go of control', 'Asking for help', 'Finishing what they start'],
    allowOther: true,
  },
  {
    id: 18,
    category: 'growth',
    type: 'freetext',
    section: 'Growth Edges & Blind Spots',
    sectionDescription: "The stuff {name} can't see about themselves. This is the gold.",
    text: "What's a pattern you've noticed in {name} that they might not see themselves?",
  },
  {
    id: 19,
    category: 'growth',
    type: 'freetext',
    section: 'Growth Edges & Blind Spots',
    sectionDescription: "The stuff {name} can't see about themselves. This is the gold.",
    text: 'If you could sit {name} down and tell them one hard truth with love, what would it be?',
  },

  // ─── SECTION 7: Social Dynamics & Role (Q20–21) ───
  {
    id: 20,
    category: 'social',
    type: 'mc',
    section: 'Social Dynamics',
    sectionDescription: 'Who {name} is in the group — and what they bring to the table.',
    text: 'In a friend group, {name} naturally becomes the…',
    options: ['Leader/organizer', 'Emotional glue', 'Entertainer', 'Quiet observer', "Devil's advocate", 'Peacemaker'],
    allowOther: true,
  },
  {
    id: 21,
    category: 'social',
    type: 'mc',
    section: 'Social Dynamics',
    sectionDescription: 'Who {name} is in the group — and what they bring to the table.',
    text: "What would the friend group lose if {name} wasn't in it?",
    options: ['The deep conversations', 'The spontaneity', 'The emotional safety', 'The laughter', 'The honesty', 'The plans actually happening'],
    allowOther: true,
  },

  // ─── SECTION 8: Habits (Q22) ───
  {
    id: 22,
    category: 'habits',
    type: 'mc',
    section: 'The Honest Bit',
    sectionDescription: 'Delivered with honesty and humor.',
    text: "What's {name}'s most annoying habit?",
    options: ['Overthinking everything', 'Being chronically late', 'Interrupting', 'Giving unsolicited advice', 'Being on their phone too much', 'Saying "I\'m fine" when they\'re clearly not'],
    allowOther: true,
  },

  // ─── SECTION 9: Appreciation (Q23–24) ───
  {
    id: 23,
    category: 'appreciation',
    type: 'freetext',
    section: 'What Makes You Special',
    sectionDescription: 'The good stuff. What people actually value about {name}.',
    text: 'What do you genuinely appreciate most about having {name} in your life?',
  },
  {
    id: 24,
    category: 'appreciation',
    type: 'freetext',
    section: 'What Makes You Special',
    sectionDescription: 'The good stuff. What people actually value about {name}.',
    text: 'What makes {name} irreplaceable? What would be impossible to find in someone else?',
  },

  // ─── SECTION 10: The Final Word (Q25) ───
  {
    id: 25,
    category: 'final',
    type: 'freetext',
    section: 'The Final Word',
    sectionDescription: 'Open floor.',
    text: 'If {name} could only read one message from this entire questionnaire, what would you want them to know?',
  },
]

export const getQuestionsForName = (name: string): Question[] =>
  questions.map((q) => ({
    ...q,
    text: q.text.replace(/\{name\}/g, name),
    section: q.section,
    sectionDescription: q.sectionDescription.replace(/\{name\}/g, name),
  }))
