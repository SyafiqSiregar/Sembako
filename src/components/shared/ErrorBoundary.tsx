import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-card border border-border rounded-card p-6 shadow-xl space-y-5 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="size-14 mx-auto rounded-full bg-destructive/15 text-destructive flex items-center justify-center">
              <AlertTriangle className="size-7" aria-hidden="true" />
            </div>

            <div className="space-y-1.5">
              <h1 className="text-lg font-serif font-bold text-foreground">
                Terjadi Kendala Tampilan
              </h1>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Aplikasi mengalami galat saat memuat komponen antarmuka. Data transaksi dan stok Anda tetap aman di database lokal.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-muted rounded-card border border-border text-left">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                  Pesan Galat Sistem:
                </span>
                <p className="text-xs font-mono text-destructive font-semibold break-all">
                  {this.state.error.message || 'Unknown error'}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 min-h-[44px] px-4 rounded-pill bg-primary text-primary-foreground font-semibold text-xs flex items-center justify-center gap-2 hover:bg-primary/90 transition cursor-pointer"
              >
                <RefreshCw className="size-4" /> Muat Ulang Halaman
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="flex-1 min-h-[44px] px-4 rounded-pill border border-input bg-card text-foreground font-semibold text-xs flex items-center justify-center gap-2 hover:bg-muted transition cursor-pointer"
              >
                <Home className="size-4" /> Ke Beranda
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
