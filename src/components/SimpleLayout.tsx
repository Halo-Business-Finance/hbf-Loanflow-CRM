import React from "react"
import { ReactNode, useState, useEffect } from "react"
import { Clock } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { NotificationBell } from "@/components/NotificationBell"
import { GlobalSearch } from "@/components/GlobalSearch"
import { ThemeToggle } from "@/components/ThemeToggle"
import { ConnectionHalo } from "@/components/ConnectionHalo"

interface SimpleLayoutProps {
  children: ReactNode
}

export default function SimpleLayout({ children }: SimpleLayoutProps) {
  const [currentDateTime, setCurrentDateTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date())
    }, 60000) // Update every minute instead of every second

    return () => clearInterval(timer)
  }, [])

  const formatDateTime = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }
    return date.toLocaleDateString('en-US', options)
  }

  return (
    <div className="min-h-screen flex flex-col w-full bg-background overflow-hidden">
      <header className="h-20 border-b bg-card shadow-soft flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <ConnectionHalo />
          <h1 className="text-xl font-semibold text-primary dark:text-white no-underline">Halo Business Finance</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:block w-80">
            <GlobalSearch />
          </div>
          <ThemeToggle />
          <NotificationBell />
        </div>
      </header>
      <main className="flex-1 p-6 bg-muted/30 overflow-auto no-scrollbar">
        {children}
      </main>
    </div>
  )
}