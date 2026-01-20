// eslint.config.mjs
import js from '@eslint/js'
import next from '@next/eslint-plugin-next'
import prettier from 'eslint-plugin-prettier'

export default [
  js.configs.recommended,

  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      '@next/next': next,
      prettier,
    },
    rules: {
      // Next.js recommended rules
      ...next.configs.recommended.rules,
      ...next.configs['core-web-vitals'].rules,

      // Run prettier as part of eslint
      'prettier/prettier': 'warn',
    },
  },
]
