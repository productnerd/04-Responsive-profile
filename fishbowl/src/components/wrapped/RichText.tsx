import { Fragment, type ReactNode } from 'react'

// Kill em/en dashes at render time. Even if a stale cached report was
// generated before the server-side scrub existed, the user never sees them.
function stripDashes(s: string): string {
  return s
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/,\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// Renders a string with **bold** markdown segments as <strong>.
// Deliberately tiny: no links, no italics, no nesting. Safe by construction
// (we build the tree from text nodes, no dangerouslySetInnerHTML).
export default function RichText({ text }: { text: string }) {
  if (!text) return null
  const clean = stripDashes(text)
  const parts: ReactNode[] = []
  const regex = /\*\*([^*]+)\*\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = regex.exec(clean)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<Fragment key={key++}>{clean.slice(lastIndex, match.index)}</Fragment>)
    }
    parts.push(
      <strong key={key++} className="text-text-primary font-semibold">
        {stripDashes(match[1])}
      </strong>
    )
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < clean.length) {
    parts.push(<Fragment key={key++}>{clean.slice(lastIndex)}</Fragment>)
  }
  return <>{parts}</>
}
