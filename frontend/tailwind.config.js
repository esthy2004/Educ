/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Vert forêt profond (#244B3C) — navigation, titres, aplats institutionnels.
        navy: {
          50: '#f0f4ef',
          100: '#e5ede6',
          200: '#cfdccf',
          300: '#a9c0ad',
          400: '#7d9c84',
          500: '#5b8165',
          600: '#466b52',
          700: '#355f4b',
          800: '#2c5242',
          900: '#244b3c',
          950: '#183327',
        },
        // Vert institutionnel / couleur d'action principale (#355F4B).
        royal: {
          50: '#e5ede6',
          100: '#d8e6dc',
          200: '#bcd4c3',
          300: '#97bda4',
          400: '#6fa285',
          500: '#4f8669',
          600: '#355f4b',
          700: '#2d5140',
          800: '#284535',
          900: '#244b3c',
          950: '#142b23',
        },
        // Neutres chauds (textes, bordures, séparations).
        slate: {
          50: '#f8f7f2',
          100: '#f1eee6',
          200: '#e1dccf',
          300: '#d8d2c4',
          400: '#92978f',
          500: '#747b73',
          600: '#5f665e',
          700: '#4b524b',
          800: '#303832',
          900: '#262e28',
          950: '#1b211c',
        },
        // Succès (#39815B).
        emerald: {
          50: '#eef5f0',
          100: '#dcebe1',
          200: '#bcd8c6',
          300: '#92bfa2',
          400: '#63a17b',
          500: '#468c64',
          600: '#39815b',
          700: '#2f6b4c',
          800: '#28563e',
          900: '#224633',
        },
        // Attention / doré discret (#C69B57).
        amber: {
          50: '#faf5ec',
          100: '#f4ead6',
          200: '#e9d4ae',
          300: '#ddba82',
          400: '#d0a566',
          500: '#c69b57',
          600: '#b98c47',
          700: '#96703a',
          800: '#785a31',
          900: '#61492a',
        },
        // Erreur (#BC514D).
        rose: {
          50: '#faefee',
          100: '#f4dedd',
          200: '#e7bdb9',
          300: '#d89995',
          400: '#c96f6b',
          500: '#bf5d59',
          600: '#bc514d',
          700: '#9d413e',
          800: '#803634',
          900: '#672c2b',
        },
        // Information (#648A9A).
        sky: {
          50: '#eff4f6',
          100: '#dee9ed',
          200: '#c2d6dd',
          300: '#9ebcc7',
          400: '#7ba2b1',
          500: '#648a9a',
          600: '#537786',
          700: '#45636f',
          800: '#3b535d',
          900: '#31454d',
        },
        // Aplat sauge neutre (tons secondaires, jamais décoratif).
        violet: {
          50: '#f4f6f2',
          100: '#e7ebe3',
          200: '#d2d9cc',
          300: '#b4bfab',
          400: '#94a189',
          500: '#7a8770',
          600: '#626e59',
          700: '#505a48',
          800: '#414a3b',
          900: '#343c30',
        },
        // Sauge profond.
        teal: {
          50: '#f0f4f2',
          100: '#e0eae5',
          200: '#c3d6cc',
          300: '#9bbcad',
          400: '#719e8b',
          500: '#538470',
          600: '#416b5b',
          700: '#375849',
          800: '#2f493e',
          900: '#283d34',
        },
        // Ivoire principal pour le fond applicatif.
        surface: '#f3f0e7',
        canvas: '#f3f0e7',
        // Beige de séparation, plus doux que le gris.
        line: '#e1dccf',
        ink: '#303832',
        muted: '#747b73',
      },
      fontFamily: {
        sans: [
          'Inter',
          'Segoe UI',
          'system-ui',
          '-apple-system',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px rgba(36, 75, 60, 0.05)',
        pop: '0 8px 24px -10px rgba(36, 75, 60, 0.22)',
        raised: '0 1px 2px rgba(36, 75, 60, 0.06), 0 4px 12px -6px rgba(36, 75, 60, 0.14)',
      },
      borderRadius: {
        xl2: '0.625rem',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateX(12px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.15s ease-out',
        'slide-up': 'slide-up 0.18s ease-out',
        'toast-in': 'toast-in 0.18s ease-out',
      },
    },
  },
  plugins: [],
};
