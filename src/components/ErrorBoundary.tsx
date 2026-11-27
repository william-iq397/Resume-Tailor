import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'حدث خطأ غير متوقع.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendly = 'حدث خطأ غير متوقع في التطبيق. يرجى إعادة تحميل الصفحة.';
      if (this.state.message.includes('Missing or insufficient permissions')) {
        friendly = 'ليس لديك صلاحية تنفيذ هذه العملية. تأكد من تسجيل الدخول بالحساب الصحيح.';
      }

      return (
        <div
          dir="rtl"
          className="min-h-screen flex items-center justify-center bg-[#F3F6FA] dark:bg-[#0E1624] p-6"
        >
          <div className="max-w-md w-full bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-xl p-6 space-y-4 text-center">
            <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
            <h1 className="font-display text-lg font-bold text-slate-900 dark:text-[#EEF2F8]">
              تنبيه تقني
            </h1>
            <p className="text-sm text-slate-600 dark:text-[#9FB0C7]">{friendly}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
