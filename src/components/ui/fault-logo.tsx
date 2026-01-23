import { cn } from "@/lib/utils"

interface FaultLogoProps {
  className?: string
  size?: number
}

export function FaultLogo({ className, size = 28 }: FaultLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
    >
      {/* Outer circle with gradient */}
      <circle
        cx="16"
        cy="16"
        r="15"
        fill="url(#faultGradient)"
        stroke="url(#faultStroke)"
        strokeWidth="1"
      />

      {/* Inner glow ring */}
      <circle
        cx="16"
        cy="16"
        r="12"
        fill="none"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="0.5"
      />

      {/* Fault pulse/waveform - stylized "detection" symbol */}
      <path
        d="M8 16 L11 16 L12.5 11 L14.5 21 L16.5 13 L18.5 19 L20 16 L24 16"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Small dot accent */}
      <circle
        cx="24"
        cy="16"
        r="1.5"
        fill="white"
      />

      {/* Gradient definitions */}
      <defs>
        <linearGradient
          id="faultGradient"
          x1="0"
          y1="0"
          x2="32"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#dc2626" />
        </linearGradient>
        <linearGradient
          id="faultStroke"
          x1="0"
          y1="0"
          x2="32"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
      </defs>
    </svg>
  )
}
