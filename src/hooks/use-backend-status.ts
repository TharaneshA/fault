import { useState, useEffect, useRef, useCallback } from "react"
import { checkHealth } from "@/lib/api"
import { toast } from "@/components/ui/use-toast"

export type BackendStatus = "connected" | "connecting" | "disconnected"

interface UseBackendStatusOptions {
  /** Polling interval in milliseconds (default: 5000) */
  interval?: number
  /** Whether to show toast notifications on status change (default: true) */
  showToasts?: boolean
}

export function useBackendStatus(options: UseBackendStatusOptions = {}) {
  const { interval = 5000, showToasts = true } = options

  const [status, setStatus] = useState<BackendStatus>("connecting")
  const [lastError, setLastError] = useState<string | null>(null)
  const previousStatus = useRef<BackendStatus>("connecting")
  const isFirstCheck = useRef(true)

  const checkBackendHealth = useCallback(async () => {
    try {
      await checkHealth()
      setStatus("connected")
      setLastError(null)

      // Show reconnected toast if we were disconnected
      if (showToasts && previousStatus.current === "disconnected" && !isFirstCheck.current) {
        toast({
          title: "Backend Connected",
          description: "Connection to analysis backend restored",
          duration: 3000,
        })
      }

      previousStatus.current = "connected"
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      setLastError(errorMessage)
      setStatus("disconnected")

      // Show disconnected toast if we were connected
      if (showToasts && previousStatus.current === "connected") {
        toast({
          variant: "destructive",
          title: "Backend Disconnected",
          description: "Unable to reach analysis backend",
          duration: 5000,
        })
      }

      previousStatus.current = "disconnected"
    }

    isFirstCheck.current = false
  }, [showToasts])

  useEffect(() => {
    // Initial check
    checkBackendHealth()

    // Set up polling
    const intervalId = setInterval(checkBackendHealth, interval)

    return () => clearInterval(intervalId)
  }, [checkBackendHealth, interval])

  return {
    status,
    lastError,
    isConnected: status === "connected",
    isConnecting: status === "connecting",
    isDisconnected: status === "disconnected",
    refresh: checkBackendHealth,
  }
}
