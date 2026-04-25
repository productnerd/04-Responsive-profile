import { useMemo } from 'react'

const BUBBLE_COUNT = 20

interface Bubble {
  id: number
  size: number
  left: number
  duration: number
  delay: number
  opacity: number
}

function makeBubbles(): Bubble[] {
  return Array.from({ length: BUBBLE_COUNT }, (_, i) => ({
    id: i,
    size: 6 + Math.random() * 34,
    left: Math.random() * 100,
    duration: 7 + Math.random() * 10,
    delay: Math.random() * 12,
    opacity: 0.15 + Math.random() * 0.4,
  }))
}

export default function SeaBackground() {
  const bubbles = useMemo(makeBubbles, [])

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {/* SVG filter for water distortion */}
      <svg className="absolute w-0 h-0" aria-hidden="true">
        <defs>
          <filter id="water-distortion">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.015 0.02"
              numOctaves={3}
              seed={2}
              result="noise"
            >
              <animate
                attributeName="baseFrequency"
                values="0.015 0.02;0.018 0.025;0.015 0.02"
                dur="8s"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale={18}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* Video background with distortion */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ filter: 'url(#water-distortion)' }}
      >
        <source src={`${import.meta.env.BASE_URL}sea.mp4`} type="video/mp4" />
      </video>

      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-surface/75" />

      {/* Bubbles */}
      {bubbles.map((b) => (
        <span
          key={b.id}
          className="absolute rounded-full bg-white/20 border border-white/10 animate-bubble-rise"
          style={{
            width: b.size,
            height: b.size,
            left: `${b.left}%`,
            bottom: `-${b.size + 10}px`,
            opacity: b.opacity,
            animationDuration: `${b.duration}s`,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}

      <style>{`
        @keyframes bubble-rise {
          0% {
            transform: translateY(0) translateX(0) scale(1);
          }
          25% {
            transform: translateY(-25vh) translateX(8px) scale(1.05);
          }
          50% {
            transform: translateY(-50vh) translateX(-6px) scale(0.95);
          }
          75% {
            transform: translateY(-75vh) translateX(10px) scale(1.02);
          }
          100% {
            transform: translateY(-110vh) translateX(-4px) scale(0.9);
            opacity: 0;
          }
        }
        .animate-bubble-rise {
          animation-name: bubble-rise;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
      `}</style>
    </div>
  )
}
