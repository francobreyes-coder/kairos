'use client'

import * as React from 'react'

// Wraps the chat surfaces so a render-time throw shows the actual JS error
// in-page instead of letting the browser display its generic crash banner
// (Chrome "Aw, snap" / iOS Safari "this page couldn't load"). Also installs
// window-level error + unhandledrejection listeners so async failures
// (channel callbacks, fetch errors) are visible too. Strictly a diagnostic
// aid — once we know the actual error we can replace it with a real fix.

interface State {
  renderError: Error | null
  asyncError: { kind: 'error' | 'rejection'; message: string; stack?: string } | null
}

export class MessagesErrorBoundary extends React.Component<
  { children: React.ReactNode; label?: string },
  State
> {
  state: State = { renderError: null, asyncError: null }
  private onError = (event: ErrorEvent) => {
    this.setState({
      asyncError: {
        kind: 'error',
        message: event.message || 'Unknown error',
        stack: event.error?.stack,
      },
    })
  }
  private onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason
    this.setState({
      asyncError: {
        kind: 'rejection',
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
      },
    })
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { renderError: error }
  }

  componentDidMount() {
    if (typeof window === 'undefined') return
    window.addEventListener('error', this.onError)
    window.addEventListener('unhandledrejection', this.onRejection)
  }

  componentWillUnmount() {
    if (typeof window === 'undefined') return
    window.removeEventListener('error', this.onError)
    window.removeEventListener('unhandledrejection', this.onRejection)
  }

  render() {
    const { renderError, asyncError } = this.state
    if (!renderError && !asyncError) return this.props.children
    const label = this.props.label ?? 'chat'
    return (
      <div style={{ padding: 20, margin: 16, background: '#FFF5F5', border: '1px solid #FCA5A5', borderRadius: 12, color: '#7F1D1D', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, lineHeight: 1.5, overflow: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
          The {label} hit an error. Share this with the developer:
        </div>
        {renderError && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Render error: {renderError.message}</div>
            {renderError.stack && (
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{renderError.stack}</pre>
            )}
          </div>
        )}
        {asyncError && (
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              {asyncError.kind === 'rejection' ? 'Unhandled promise: ' : 'Async error: '}{asyncError.message}
            </div>
            {asyncError.stack && (
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{asyncError.stack}</pre>
            )}
          </div>
        )}
        <button
          onClick={() => this.setState({ renderError: null, asyncError: null })}
          style={{ marginTop: 12, padding: '6px 12px', borderRadius: 8, border: '1px solid #FCA5A5', background: 'white', color: '#7F1D1D', cursor: 'pointer', fontSize: 12 }}
        >
          Dismiss
        </button>
      </div>
    )
  }
}
