import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

interface Props {
  options: string[]
  selected: string | null
  onSelect: (value: string) => void
  allowOther?: boolean
}

export default function MultipleChoice({ options, selected, onSelect, allowOther }: Props) {
  // Determine if the current selection is an "Other" custom value
  const isOtherSelected =
    selected !== null && selected !== '' && !options.includes(selected)
  const [otherMode, setOtherMode] = useState<boolean>(isOtherSelected)
  const [otherText, setOtherText] = useState<string>(isOtherSelected ? selected! : '')
  const otherInputRef = useRef<HTMLInputElement>(null)

  // Sync when question changes / selected changes externally
  useEffect(() => {
    const otherNow = selected !== null && selected !== '' && !options.includes(selected)
    setOtherMode(otherNow)
    setOtherText(otherNow ? selected! : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options])

  useEffect(() => {
    if (otherMode) otherInputRef.current?.focus()
  }, [otherMode])

  return (
    <div className="flex flex-col gap-3 w-full max-w-lg">
      {options.map((option, i) => (
        <motion.button
          key={option}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          onClick={() => {
            setOtherMode(false)
            setOtherText('')
            onSelect(option)
          }}
          className={`px-5 py-4 rounded-2xl text-left text-base font-medium transition-all duration-200 border-2 cursor-pointer ${
            selected === option && !otherMode
              ? 'bg-primary text-white border-primary shadow-lg shadow-primary/30 scale-[1.02]'
              : 'bg-white/5 border-white/10 text-text-primary hover:bg-white/10 hover:border-white/20'
          }`}
        >
          {option}
        </motion.button>
      ))}

      {allowOther && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: options.length * 0.05 }}
        >
          {otherMode ? (
            <div
              className={`px-5 py-3 rounded-2xl border-2 transition-all duration-200 ${
                isOtherSelected
                  ? 'bg-primary/10 border-primary shadow-lg shadow-primary/20'
                  : 'bg-white/5 border-white/20'
              }`}
            >
              <input
                ref={otherInputRef}
                type="text"
                value={otherText}
                onChange={(e) => {
                  const v = e.target.value
                  setOtherText(v)
                  onSelect(v)
                }}
                placeholder="Type your answer…"
                className="w-full bg-transparent text-base text-text-primary placeholder:text-text-secondary outline-none"
              />
            </div>
          ) : (
            <button
              onClick={() => {
                setOtherMode(true)
                // clear any previously selected canonical option
                onSelect('')
              }}
              className="px-5 py-4 rounded-2xl text-left text-base font-medium transition-all duration-200 border-2 border-dashed border-white/15 bg-white/[0.02] text-text-secondary hover:bg-white/5 hover:border-white/25 hover:text-text-primary cursor-pointer w-full"
            >
              ✏️  Other…
            </button>
          )}
        </motion.div>
      )}
    </div>
  )
}
