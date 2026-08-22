import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from 'react';

interface ErrorBoundaryState {
  failed: boolean;
}

export class ErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('RaceVora V2 boundary', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <main className="fatal-state" id="main-content">
          <p className="eyebrow">V2 Staging</p>
          <h1>Die Anwendung wurde sicher angehalten.</h1>
          <p>Es wurden keine weiteren Datenanfragen ausgeführt. Bitte Konfiguration und Protokoll prüfen.</p>
        </main>
      );
    }
    return this.props.children;
  }
}
