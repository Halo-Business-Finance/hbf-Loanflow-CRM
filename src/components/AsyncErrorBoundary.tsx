import { Component, ErrorInfo, ReactNode } from 'react'
import { ErrorBoundary } from './ErrorBoundary'

interface AsyncErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error) => void
}

// Class-based wrapper to avoid hook initialization issues
export class AsyncErrorBoundary extends Component<AsyncErrorBoundaryProps> {
  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    // Only log critical errors to reduce noise
    if (event.reason?.name !== 'AbortError') {
      console.error('Unhandled promise rejection:', event.reason)
    }
    
    const error = event.reason instanceof Error 
      ? event.reason 
      : new Error(String(event.reason))
    
    this.props.onError?.(error)
    event.preventDefault()
  }

  private handleError = (event: ErrorEvent) => {
    if (!event.error?.message?.includes('ResizeObserver')) {
      console.error('Unhandled error:', event.error)
    }
    
    const error = event.error instanceof Error 
      ? event.error 
      : new Error(event.message)
    
    this.props.onError?.(error)
  }

  componentDidMount() {
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection)
    window.addEventListener('error', this.handleError)
  }

  componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection)
    window.removeEventListener('error', this.handleError)
  }

  render() {
    return (
      <ErrorBoundary fallback={this.props.fallback} onError={this.props.onError}>
        {this.props.children}
      </ErrorBoundary>
    )
  }
}