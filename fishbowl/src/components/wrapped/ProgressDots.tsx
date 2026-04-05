interface Props {
  total: number
  current: number
  onNavigate: (index: number) => void
}

export default function ProgressDots({ total, current, onNavigate }: Props) {
  return (
    <div className="fixed top-4 left-0 right-0 z-30 flex justify-center">
      <div className="flex gap-1 px-3 py-2 bg-black/30 backdrop-blur-lg rounded-full max-w-[90vw] overflow-x-auto">
        {Array.from({ length: total }, (_, i) => (
          <button
            key={i}
            onClick={() => onNavigate(i)}
            className={`shrink-0 rounded-full transition-all duration-300 cursor-pointer ${
              i === current
                ? 'w-6 h-2 bg-primary'
                : i < current
                  ? 'w-2 h-2 bg-primary/40'
                  : 'w-2 h-2 bg-white/20'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
