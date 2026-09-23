import * as React from 'react';

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Application error boundary', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '32px', background: '#0b1320', color: '#edf2ff' }}>
          <div style={{ maxWidth: 480, textAlign: 'center' }}>
            <h2 style={{ marginBottom: 12 }}>Something went wrong</h2>
            <p style={{ color: '#c8d3ea', marginBottom: 20 }}>The app hit an unexpected error. Please refresh and try again.</p>
            <button className="ds-btn ds-btn--primary ds-btn--md" onClick={() => window.location.reload()}>
              Reload app
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
