import { Component, type ErrorInfo, type ReactNode } from 'react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export default class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Spiritual Growth Journal failed to render.', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-shell">
          <div className="content-shell">
            <section className="view-stack" style={{ padding: '24px 16px' }}>
              <h1>No se pudo iniciar la aplicación</h1>
              <p className="muted">Ocurrió un error al cargar el diario. Recarga la página. Si continúa, revisa la consola del navegador.</p>
              <details>
                <summary>Detalle técnico</summary>
                <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{this.state.message}</pre>
              </details>
              <button className="primary-button full" type="button" onClick={() => window.location.reload()}>Recargar</button>
            </section>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
