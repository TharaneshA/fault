import { Zap } from "lucide-react"
import { cn } from "@/lib/utils"

interface TeamSwitcherProps {
  className?: string
}

export default function TeamSwitcher({ className }: TeamSwitcherProps) {
  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-orange-500">
        <Zap className="h-4 w-4 text-white" />
      </div>
      <span className="font-bold text-lg">Fault.ai</span>
    </div>
  )
}
