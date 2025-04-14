import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './app/styles/**/*.{css,scss}'],
  theme: {
    extend: {
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
      },
      fontFamily: {
        display: [
          'GT America',
          'Inter Variable',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'Noto Sans',
          'sans-serif',
          'Apple Color Emoji',
          'Segoe UI Emoji',
          'Segoe UI Symbol',
          'Noto Color Emoji',
          'sans-serif',
        ],
      },
      colors: {
        bolt: {
          elements: {
            borderColor: 'var(--bolt-elements-borderColor)',
            borderColorActive: 'var(--bolt-elements-borderColorActive)',
            background: {
              depth: {
                1: 'var(--bolt-elements-bg-depth-1)',
                2: 'var(--bolt-elements-bg-depth-2)',
                3: 'var(--bolt-elements-bg-depth-3)',
                4: 'var(--bolt-elements-bg-depth-4)',
              },
            },
            textPrimary: 'var(--bolt-elements-textPrimary)',
            textSecondary: 'var(--bolt-elements-textSecondary)',
            textTertiary: 'var(--bolt-elements-textTertiary)',
            code: {
              background: 'var(--bolt-elements-code-background)',
              text: 'var(--bolt-elements-code-text)',
            },
            button: {
              primary: {
                background: 'var(--bolt-elements-button-primary-background)',
                backgroundHover: 'var(--bolt-elements-button-primary-backgroundHover)',
                text: 'var(--bolt-elements-button-primary-text)',
              },
              secondary: {
                background: 'var(--bolt-elements-button-secondary-background)',
                backgroundHover: 'var(--bolt-elements-button-secondary-backgroundHover)',
                text: 'var(--bolt-elements-button-secondary-text)',
              },
              danger: {
                background: 'var(--bolt-elements-button-danger-background)',
                backgroundHover: 'var(--bolt-elements-button-danger-backgroundHover)',
                text: 'var(--bolt-elements-button-danger-text)',
              },
            },
            item: {
              contentDefault: 'var(--bolt-elements-item-contentDefault)',
              contentActive: 'var(--bolt-elements-item-contentActive)',
              contentAccent: 'var(--bolt-elements-item-contentAccent)',
              contentDanger: 'var(--bolt-elements-item-contentDanger)',
              backgroundDefault: 'var(--bolt-elements-item-backgroundDefault)',
              backgroundActive: 'var(--bolt-elements-item-backgroundActive)',
              backgroundAccent: 'var(--bolt-elements-item-backgroundAccent)',
              backgroundDanger: 'var(--bolt-elements-item-backgroundDanger)',
            },
            actions: {
              background: 'var(--bolt-elements-actions-background)',
              code: {
                background: 'var(--bolt-elements-actions-code-background)',
              },
            },
            artifacts: {
              background: 'var(--bolt-elements-artifacts-background)',
              backgroundHover: 'var(--bolt-elements-artifacts-backgroundHover)',
              borderColor: 'var(--bolt-elements-artifacts-borderColor)',
              inlineCode: {
                background: 'var(--bolt-elements-artifacts-inlineCode-background)',
                text: 'var(--bolt-elements-artifacts-inlineCode-text)',
              },
            },
            messages: {
              background: 'var(--bolt-elements-messages-background)',
              linkColor: 'var(--bolt-elements-messages-linkColor)',
              code: {
                background: 'var(--bolt-elements-messages-code-background)',
              },
              inlineCode: {
                background: 'var(--bolt-elements-messages-inlineCode-background)',
                text: 'var(--bolt-elements-messages-inlineCode-text)',
              },
            },
            icon: {
              success: 'var(--bolt-elements-icon-success)',
              error: 'var(--bolt-elements-icon-error)',
            },
            preview: {
              addressBar: {
                background: 'var(--bolt-elements-preview-addressBar-background)',
                backgroundHover: 'var(--bolt-elements-preview-addressBar-backgroundHover)',
                backgroundActive: 'var(--bolt-elements-preview-addressBar-backgroundActive)',
                text: 'var(--bolt-elements-preview-addressBar-text)',
                textActive: 'var(--bolt-elements-preview-addressBar-textActive)',
              },
            },
            terminals: {
              background: 'var(--bolt-elements-terminals-background)',
              buttonBackground: 'var(--bolt-elements-terminals-buttonBackground)',
            },
            dividerColor: 'var(--bolt-elements-dividerColor)',
            loader: {
              background: 'var(--bolt-elements-loader-background)',
              progress: 'var(--bolt-elements-loader-progress)',
            },
            prompt: {
              background: 'var(--bolt-elements-prompt-background)',
            },
            cta: {
              background: 'var(--bolt-elements-cta-background)',
              text: 'var(--bolt-elements-cta-text)',
            },
          },
        },
      },
      transitionTimingFunction: {
        'bolt-cubic-bezier': 'cubic-bezier(0.4,0,0.2,1)',
      },
      maxWidth: {
        chat: 'var(--chat-max-width)',
      },
    },
  },
  plugins: [],
  darkMode: ['selector', '[data-mode="dark"]'],
} satisfies Config;
