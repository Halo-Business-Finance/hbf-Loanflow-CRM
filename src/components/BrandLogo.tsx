import React from "react"
import { cn } from "@/lib/utils"

interface BrandLogoProps {
  size?: number
  showText?: boolean
  text?: string
  className?: string
  imageSrc?: string // Path in public/ e.g. "/logo.svg" or "/logo.png"
  textClassName?: string
  imageClassName?: string
}

export function BrandLogo({
  size = 32,
  showText = true,
  text = "LoanFlow CRM",
  className,
  imageSrc = "/logo.png",
  textClassName,
  imageClassName,
}: BrandLogoProps) {
  return (
    <div className={cn("flex items-center", className)}>
      <img
        src={imageSrc}
        alt="LoanFlow CRM logo"
        title="LoanFlow CRM"
        loading="lazy"
        className={cn("bg-transparent object-contain select-none pointer-events-none", imageClassName)}
        style={{ height: size, width: 'auto' }}
      />
      {showText && (
        <span className={cn("ml-2 font-semibold text-lg", textClassName || "text-foreground")} aria-label="LoanFlow CRM brand name">
          {text}
        </span>
      )}
    </div>
  )
}
