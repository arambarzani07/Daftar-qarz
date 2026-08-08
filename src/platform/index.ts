/**
 * ZHIROX Platform Abstraction Layer
 * Provides uniform APIs for Web PWA, Mobile Web, and future Capacitor native bridges.
 */

export interface ShareOptions {
  title?: string;
  text?: string;
  url?: string;
}

export const platform = {
  isNative: (): boolean => {
    return (
      typeof window !== 'undefined' &&
      !!(window as any).Capacitor?.isNativePlatform?.()
    );
  },

  isInstalledPwa: (): boolean => {
    if (typeof window === 'undefined') return false;
    const isStandaloneDisplay = window.matchMedia('(display-mode: standalone)').matches;
    const isIosStandalone = (window.navigator as any).standalone === true;
    return isStandaloneDisplay || isIosStandalone;
  },

  isStandalone: (): boolean => {
    return platform.isInstalledPwa() || platform.isNative();
  },

  share: async (options: ShareOptions): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(options);
        return true;
      } catch (err: any) {
        if (err.name === 'AbortError') return false;
        console.warn('Web Share failed, attempting clipboard fallback:', err);
      }
    }

    // Fallback to clipboard
    const textToCopy = [options.title, options.text, options.url].filter(Boolean).join('\n\n');
    return platform.clipboard.copy(textToCopy);
  },

  clipboard: {
    copy: async (text: string): Promise<boolean> => {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch (err) {
          console.warn('Clipboard writeText failed:', err);
        }
      }

      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
      } catch (err) {
        console.error('Fallback clipboard copy failed:', err);
        return false;
      }
    }
  },

  haptics: {
    success: (): void => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([10, 30, 20]);
      }
    },
    warning: (): void => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([30, 50, 30]);
      }
    },
    error: (): void => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([50, 100, 50, 100, 50]);
      }
    }
  },

  openExternal: (url: string): void => {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  },

  pickFile: (accept = '*/*'): Promise<File | null> => {
    return new Promise((resolve) => {
      if (typeof document === 'undefined') return resolve(null);
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.onchange = (e: any) => {
        const files = e.target?.files;
        if (files && files.length > 0) {
          resolve(files[0]);
        } else {
          resolve(null);
        }
      };
      input.click();
    });
  }
};
