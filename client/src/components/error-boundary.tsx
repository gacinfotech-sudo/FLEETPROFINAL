import { Component, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error);
    console.error('Component Stack:', errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Something went wrong
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-red-700">
            <p className="mb-2">An error occurred while rendering this page.</p>
            <details className="mt-3">
              <summary className="cursor-pointer font-mono text-xs">Error details</summary>
              <pre className="mt-2 bg-white p-2 rounded text-xs overflow-auto max-h-48">
                {this.state.error?.toString()}
              </pre>
            </details>
            <p className="mt-3 text-xs">Please try refreshing the page. If the problem persists, contact support.</p>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
