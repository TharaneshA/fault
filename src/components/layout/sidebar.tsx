"use client"

import { NavLink, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  AlertTriangle,
  Network,
  BarChart3,
  Settings,
  ChevronLeft,
} from "lucide-react"
import { useState } from "react"
import { FaultLogo } from "@/components/ui/fault-logo"

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Overview" },
  { to: "/cases", icon: AlertTriangle, label: "Cases" },
  { to: "/analysis", icon: Network, label: "Analysis" },
  { to: "/comparison", icon: BarChart3, label: "Benchmarks" },
  { to: "/settings", icon: Settings, label: "Settings" },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-app bg-app-secondary transition-all duration-200",
        collapsed ? "w-14" : "w-52"
      )}
    >
      {/* Logo */}
      <div className="flex h-12 items-center gap-2 border-b border-app px-3">
        <FaultLogo size={28} />
        {!collapsed && (
          <span className="font-display text-sm font-black tracking-normal text-app">Fault.ai</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 p-2">
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.to ||
            (item.to !== "/dashboard" && location.pathname.startsWith(item.to))

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-app-tertiary text-app"
                  : "text-app-secondary hover:bg-app-surface-hover hover:text-app"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* Collapse button */}
      <div className="border-t border-app p-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-app-muted transition-colors hover:bg-app-surface-hover hover:text-app-secondary"
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 transition-transform",
              collapsed && "rotate-180"
            )}
          />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  )
}
