tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'system-ui', 'sans-serif'],
          },
          borderRadius: {
            'ios': '12px',
            'ios-lg': '16px',
            'ios-xl': '20px',
            'ios-2xl': '24px',
            'ios-3xl': '32px',
          },
          colors: {
            background: 'hsl(var(--aifnmjmchg-m-background))',
            foreground: 'hsl(var(--aifnmjmchg-m-foreground))',
            card: {
              DEFAULT: 'hsl(var(--aifnmjmchg-m-card))',
              foreground: 'hsl(var(--aifnmjmchg-m-card-foreground))',
            },
            primary: {
              DEFAULT: 'hsl(var(--aifnmjmchg-m-primary))',
              foreground: 'hsl(var(--aifnmjmchg-m-primary-foreground))',
            },
            secondary: {
              DEFAULT: 'hsl(var(--aifnmjmchg-m-secondary))',
              foreground: 'hsl(var(--aifnmjmchg-m-secondary-foreground))',
            },
            muted: {
              DEFAULT: 'hsl(var(--aifnmjmchg-m-muted))',
              foreground: 'hsl(var(--aifnmjmchg-m-muted-foreground))',
            },
            accent: {
              DEFAULT: 'hsl(var(--aifnmjmchg-m-accent))',
              foreground: 'hsl(var(--aifnmjmchg-m-accent-foreground))',
            },
            border: 'hsl(var(--aifnmjmchg-m-border))',
            ring: 'hsl(var(--aifnmjmchg-m-ring))',
          },
        },
      },
    }