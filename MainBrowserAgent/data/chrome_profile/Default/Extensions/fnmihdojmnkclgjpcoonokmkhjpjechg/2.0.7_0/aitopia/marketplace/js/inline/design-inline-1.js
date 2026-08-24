tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
          },
          colors: {
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
            }
          },
          borderRadius: {
            'ios': '10px',
            'ios-lg': '14px',
            'ios-xl': '20px',
            'ios-2xl': '24px',
          },
        },
      },
    }