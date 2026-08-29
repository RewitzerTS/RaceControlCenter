import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from 'react';
import { AppState } from './AppState';

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
        <AppState
          action={<button className="primary-action" onClick={() => window.location.reload()} type="button">Seite neu laden</button>}
          copy="Ein unerwarteter Fehler hat diese Ansicht unterbrochen. Lade die Seite neu, um fortzufahren."
          title="RaceVora konnte nicht weiterladen"
          tone="error"
        />
      );
    }
    return this.props.children;
  }
}
