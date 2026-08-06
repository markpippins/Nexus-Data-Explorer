import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Terminal, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught React rendering error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetState = () => {
    try {
      localStorage.clear();
    } catch (e) {
      console.warn('Failed to clear localStorage:', e);
    }
    window.location.reload();
  };

  private toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-mono select-text">
          <div className="max-w-3xl w-full bg-slate-900 border border-red-500/50 rounded-xl p-6 space-y-5 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-950/80 border border-red-800 rounded-lg text-red-400">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-base font-bold text-red-400 flex items-center gap-2">
                    NEBULA-CONTROL-PLANE // RENDERING DIAGNOSTIC FALLBACK
                  </h1>
                  <p className="text-sm text-slate-400 mt-0.5">
                    An unhandled rendering exception was intercepted by the Error Boundary.
                  </p>
                </div>
              </div>
            </div>

            {/* Error Message Box */}
            <div className="p-4 bg-slate-950 rounded-lg border border-red-900/60 space-y-2">
              <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider block">
                Intercepted Error:
              </span>
              <p className="text-sm font-bold text-slate-200">
                {this.state.error?.toString() || 'Unknown React rendering error'}
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={this.handleReload}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-sm font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Application
              </button>

              <button
                onClick={this.handleResetState}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-md text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-amber-400" />
                Clear Local Cache & Reset
              </button>

              <button
                onClick={this.toggleDetails}
                className="px-3 py-2 bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800 rounded-md text-sm font-bold flex items-center gap-1.5 ml-auto transition-colors cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5 text-purple-400" />
                {this.state.showDetails ? 'Hide Technical Details' : 'Show Component Stack'}
                {this.state.showDetails ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Collapsible Error Stack Details */}
            {this.state.showDetails && (
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <span className="text-sm font-bold text-purple-400 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" />
                  React Component Stack Trace:
                </span>
                <pre className="p-3 bg-slate-950 rounded-md border border-slate-800 text-[11px] text-slate-300 overflow-x-auto max-h-64 leading-relaxed font-mono">
                  {this.state.errorInfo?.componentStack || this.state.error?.stack || 'No stack trace available.'}
                </pre>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
