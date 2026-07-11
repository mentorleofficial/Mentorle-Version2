import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface State {
  error: Error | null;
}

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // eslint-disable-next-line no-console
    console.error("[error-boundary]", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
          <p className="text-muted-foreground text-sm">
            {error.message || "An unexpected error occurred. Please try again."}
          </p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reload page
            </Button>
            <Button onClick={this.reset}>Try again</Button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
