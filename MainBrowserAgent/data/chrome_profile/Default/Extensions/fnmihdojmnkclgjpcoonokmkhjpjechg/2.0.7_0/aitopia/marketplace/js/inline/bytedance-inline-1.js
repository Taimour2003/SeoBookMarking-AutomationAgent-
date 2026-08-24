tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
          colors: {
            ios: { blue: '#007AFF', green: '#34C759', orange: '#FF9500', red: '#FF3B30', purple: '#AF52DE' },
            bytedance: { primary: '#325ab4', secondary: '#fe2c55' }
          },
          borderRadius: { 'ios': '10px', 'ios-lg': '14px', 'ios-xl': '20px', 'ios-2xl': '24px' }
        }
      }
    }