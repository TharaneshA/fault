import { NavLink } from "react-router-dom"
import { cn } from "@/lib/utils"

export function MainNav({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <nav
      className={cn("flex items-center space-x-4 lg:space-x-6", className)}
      {...props}
    >
      <NavLink
        to="/dashboard"
        className={({ isActive }) =>
          cn(
            "text-sm font-medium transition-colors hover:text-primary",
            isActive ? "text-foreground" : "text-muted-foreground"
          )
        }
      >
        Dashboard
      </NavLink>
      <NavLink
        to="/cases"
        className={({ isActive }) =>
          cn(
            "text-sm font-medium transition-colors hover:text-primary",
            isActive ? "text-foreground" : "text-muted-foreground"
          )
        }
      >
        Cases
      </NavLink>
      <NavLink
        to="/analysis"
        className={({ isActive }) =>
          cn(
            "text-sm font-medium transition-colors hover:text-primary",
            isActive ? "text-foreground" : "text-muted-foreground"
          )
        }
      >
        Analysis
      </NavLink>
      <NavLink
        to="/comparison"
        className={({ isActive }) =>
          cn(
            "text-sm font-medium transition-colors hover:text-primary",
            isActive ? "text-foreground" : "text-muted-foreground"
          )
        }
      >
        Comparison
      </NavLink>
      <NavLink
        to="/settings"
        className={({ isActive }) =>
          cn(
            "text-sm font-medium transition-colors hover:text-primary",
            isActive ? "text-foreground" : "text-muted-foreground"
          )
        }
      >
        Settings
      </NavLink>
    </nav>
  )
}
