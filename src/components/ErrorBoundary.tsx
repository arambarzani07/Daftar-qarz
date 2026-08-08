// @ts-nocheck
import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ZHIROX Uncaught UI Error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div dir="rtl" className="min-h-screen bg-black text-[#F5F5F7] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-full max-w-md bg-[#1C1C1E] border border-[#2C2C2E] rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-extrabold text-[#F5F5F7]">هەڵەیەک ڕوویدا</h2>
              <p className="text-xs text-[#8E8E93] leading-relaxed">
                تکایە دڵنیابەرەوە لە پەیوەندی ئینتەرنێتەکەت و پەڕەکە نوێ بکەرەوە.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="w-full py-3 bg-[#2C2C2E] hover:bg-[#3A3A3C] text-[#F5F5F7] rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>نوێکردنەوەی پەڕە</span>
              </button>

              <button
                onClick={this.handleGoHome}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-black rounded-2xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow"
              >
                <Home className="w-4 h-4" />
                <span>پەڕەی سەرەکی</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
