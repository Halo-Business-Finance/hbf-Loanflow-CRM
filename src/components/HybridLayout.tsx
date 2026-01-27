import React from "react"
import { IBMCloudLayout } from "./layouts/IBMCloudLayout"

interface HybridLayoutProps {
  children: React.ReactNode
}

export default function HybridLayout({ children }: HybridLayoutProps) {
  return (
    <IBMCloudLayout>
      {children}
    </IBMCloudLayout>
  )
}