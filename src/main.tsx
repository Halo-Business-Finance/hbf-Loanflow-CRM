import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initializeSecurityHeaders, setupCSPReporting } from './lib/content-security-policy'

// Initialize security headers immediately (never block app boot)
try {
  initializeSecurityHeaders()
  setupCSPReporting()
} catch (e) {
  // Prevent a hard white-screen if a browser blocks security APIs
  console.error('[boot] security init failed', e)
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
