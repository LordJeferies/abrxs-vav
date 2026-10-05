import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; moduleId: string; }
interface State { error: Error | null; }

/** Regla de aislamiento del addendum §7: un módulo que crashea NUNCA tumba el shell. */
export class ModuleErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="content">
        <section className="hero compact glass">
          <div>
            <p className="eyebrow">MÓDULO AISLADO</p>
            <h2>Este módulo encontró un problema</h2>
            <p>Tu proyecto y los demás módulos están intactos.</p>
          </div>
        </section>
        <div className="grid two">
          <section className="glass card">
            <h3>Detalle técnico</h3>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12 }}>{this.state.error.message}</pre>
          </section>
          <section className="glass card">
            <h3>Acciones</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="primary" onClick={() => this.setState({ error: null })}>Reintentar</button>
              <button onClick={() => { void navigator.clipboard?.writeText(`[${this.props.moduleId}] ${this.state.error?.stack ?? this.state.error?.message ?? ''}`); }}>Copiar diagnóstico</button>
            </div>
          </section>
        </div>
      </div>
    );
  }
}
