import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface SplashScreenProps {
  onComplete: () => void
  duration?: number
}

export function SplashScreen({ onComplete, duration = 2500 }: SplashScreenProps) {
  const [phase, setPhase] = useState<"enter" | "show" | "exit">("enter")

  useEffect(() => {
    // Enter phase (fade in)
    const enterTimer = setTimeout(() => {
      setPhase("show")
    }, 100)

    // Exit phase (fade out)
    const exitTimer = setTimeout(() => {
      setPhase("exit")
    }, duration - 500)

    // Complete
    const completeTimer = setTimeout(() => {
      onComplete()
    }, duration)

    return () => {
      clearTimeout(enterTimer)
      clearTimeout(exitTimer)
      clearTimeout(completeTimer)
    }
  }, [duration, onComplete])

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center bg-[#09090b] transition-opacity duration-500",
        phase === "enter" && "opacity-0",
        phase === "show" && "opacity-100",
        phase === "exit" && "opacity-0"
      )}
    >
      {/* Background gradient pulse */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-gradient-to-r from-orange-500/10 via-red-500/10 to-orange-500/10 blur-3xl" />
      </div>

      {/* Animated nodes */}
      <div className="absolute inset-0">
        <NetworkAnimation />
      </div>

      {/* Center content */}
      <div
        className={cn(
          "relative z-10 flex flex-col items-center gap-6 transition-all duration-700",
          phase === "enter" && "scale-90 opacity-0",
          phase === "show" && "scale-100 opacity-100",
          phase === "exit" && "scale-110 opacity-0"
        )}
      >
        {/* Logo */}
        <div className="relative">
          <svg
            width="80"
            height="80"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="animate-logo-pulse"
          >
            {/* Outer glow */}
            <circle
              cx="16"
              cy="16"
              r="15"
              fill="url(#splashGradient)"
              className="animate-logo-glow"
            />

            {/* Inner ring */}
            <circle
              cx="16"
              cy="16"
              r="12"
              fill="none"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="0.5"
            />

            {/* Pulse waveform - animated */}
            <path
              d="M8 16 L11 16 L12.5 11 L14.5 21 L16.5 13 L18.5 19 L20 16 L24 16"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              className="animate-draw-line"
            />

            {/* Dot */}
            <circle
              cx="24"
              cy="16"
              r="1.5"
              fill="white"
              className="animate-dot-pulse"
            />

            <defs>
              <linearGradient
                id="splashGradient"
                x1="0"
                y1="0"
                x2="32"
                y2="32"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#dc2626" />
              </linearGradient>
            </defs>
          </svg>

          {/* Ripple effect */}
          <div className="absolute inset-0 animate-ripple rounded-full border border-orange-500/50" />
          <div className="absolute inset-0 animate-ripple-delayed rounded-full border border-orange-500/30" />
        </div>

        {/* Text */}
        <div className="flex flex-col items-center gap-1">
          <h1 className="font-display text-2xl font-black tracking-normal text-white">
            Fault.ai
          </h1>
          <p className="text-sm text-white/50">
            Resolve Incidents 10x Faster
          </p>
        </div>

        {/* Loading indicator */}
        <div className="flex items-center gap-1">
          <div className="h-1 w-1 animate-bounce rounded-full bg-orange-500" style={{ animationDelay: "0ms" }} />
          <div className="h-1 w-1 animate-bounce rounded-full bg-orange-500" style={{ animationDelay: "150ms" }} />
          <div className="h-1 w-1 animate-bounce rounded-full bg-orange-500" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  )
}

// Animated network nodes background
function NetworkAnimation() {
  const nodes = [
    { x: "20%", y: "30%", delay: "0s" },
    { x: "75%", y: "25%", delay: "0.2s" },
    { x: "15%", y: "65%", delay: "0.4s" },
    { x: "80%", y: "70%", delay: "0.1s" },
    { x: "35%", y: "80%", delay: "0.3s" },
    { x: "65%", y: "85%", delay: "0.5s" },
    { x: "45%", y: "20%", delay: "0.15s" },
    { x: "90%", y: "45%", delay: "0.25s" },
    { x: "10%", y: "45%", delay: "0.35s" },
  ]

  const connections = [
    { from: 0, to: 1 },
    { from: 0, to: 2 },
    { from: 1, to: 3 },
    { from: 2, to: 4 },
    { from: 3, to: 5 },
    { from: 4, to: 5 },
    { from: 6, to: 0 },
    { from: 6, to: 1 },
    { from: 7, to: 1 },
    { from: 7, to: 3 },
    { from: 8, to: 0 },
    { from: 8, to: 2 },
  ]

  return (
    <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
      {/* Connection lines */}
      {connections.map((conn, i) => (
        <line
          key={`line-${i}`}
          x1={nodes[conn.from].x}
          y1={nodes[conn.from].y}
          x2={nodes[conn.to].x}
          y2={nodes[conn.to].y}
          stroke="rgba(249, 115, 22, 0.15)"
          strokeWidth="1"
          className="animate-connection-draw"
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}

      {/* Nodes */}
      {nodes.map((node, i) => (
        <g key={`node-${i}`} style={{ animationDelay: node.delay }}>
          {/* Outer glow */}
          <circle
            cx={node.x}
            cy={node.y}
            r="8"
            fill="rgba(249, 115, 22, 0.1)"
            className="animate-node-pulse"
            style={{ animationDelay: node.delay }}
          />
          {/* Core */}
          <circle
            cx={node.x}
            cy={node.y}
            r="3"
            fill="rgba(249, 115, 22, 0.6)"
            className="animate-node-appear"
            style={{ animationDelay: node.delay }}
          />
        </g>
      ))}
    </svg>
  )
}
