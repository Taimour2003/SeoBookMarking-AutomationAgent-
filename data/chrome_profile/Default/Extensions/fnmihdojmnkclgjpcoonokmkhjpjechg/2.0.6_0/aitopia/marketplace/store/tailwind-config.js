tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'system-ui', 'sans-serif'],
      },
      colors: {
        // iOS System Colors
        ios: {
          blue: '#007AFF',
          green: '#34C759',
          indigo: '#5856D6',
          orange: '#FF9500',
          pink: '#FF2D55',
          purple: '#AF52DE',
          red: '#FF3B30',
          teal: '#5AC8FA',
          yellow: '#FFCC00',
          gray: {
            DEFAULT: '#8E8E93',
            2: '#AEAEB2',
            3: '#C7C7CC',
            4: '#D1D1D6',
            5: '#E5E5EA',
            6: '#F2F2F7',
          }
        },
        // shadcn/ui inspired
        background: 'hsl(var(--aifnmjmchg-m-background))',
        foreground: 'hsl(var(--aifnmjmchg-m-foreground))',
        card: 'hsl(var(--aifnmjmchg-m-card))',
        'card-foreground': 'hsl(var(--aifnmjmchg-m-card-foreground))',
        popover: 'hsl(var(--aifnmjmchg-m-popover))',
        'popover-foreground': 'hsl(var(--aifnmjmchg-m-popover-foreground))',
        primary: 'hsl(var(--aifnmjmchg-m-primary))',
        'primary-foreground': 'hsl(var(--aifnmjmchg-m-primary-foreground))',
        secondary: 'hsl(var(--aifnmjmchg-m-secondary))',
        'secondary-foreground': 'hsl(var(--aifnmjmchg-m-secondary-foreground))',
        muted: 'hsl(var(--aifnmjmchg-m-muted))',
        'muted-foreground': 'hsl(var(--aifnmjmchg-m-muted-foreground))',
        accent: 'hsl(var(--aifnmjmchg-m-accent))',
        'accent-foreground': 'hsl(var(--aifnmjmchg-m-accent-foreground))',
        destructive: 'hsl(var(--aifnmjmchg-m-destructive))',
        border: 'hsl(var(--aifnmjmchg-m-border))',
        input: 'hsl(var(--aifnmjmchg-m-input))',
        ring: 'hsl(var(--aifnmjmchg-m-ring))',
      },
      borderRadius: {
        'ios': '10px',
        'ios-lg': '14px',
        'ios-xl': '20px',
        'ios-2xl': '24px',
        'ios-3xl': '32px',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'fade-up': 'fadeUp 0.5s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'shimmer': 'shimmer 2s infinite',
        'pulse-soft': 'pulseSoft 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(100%)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
}

