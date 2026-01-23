"use client"

import { useCallback } from "react"
import { WindowTitlebar } from "tauri-controls"
import { getCurrentWindow } from "@tauri-apps/api/window"

export function Menu() {
  const closeWindow = useCallback(async () => {
    const window = getCurrentWindow()
    await window.close()
  }, [])

  return (
    <WindowTitlebar className="h-8 bg-transparent" data-tauri-drag-region>
      <div className="flex-1" data-tauri-drag-region />
    </WindowTitlebar>
  )
}
