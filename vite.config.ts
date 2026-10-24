import { defineConfig } from 'vite-plus';

/** Import aliases, mirrored in tsconfig.json `paths` */
const alias = { '@/': '/src/', '@assets/': '/assets/', '@public/': '/public/' };

/**
 * Kept out of formatting and linting: AI assistant and tool directories, the skills lock file,
 * and the promo video project, which has its own toolchain (promo/AGENTS.md)
 */
const TOOLING_DIRS = [
  '.agents/**',
  '.claude/**',
  '.playwright-mcp/**',
  'skills-lock.json',
  'promo/**',
];

export default defineConfig({
  resolve: { alias },
  build: {
    rolldownOptions: {
      // One page for the game and one per prototype (paths from the project root)
      input: {
        main: 'index.html',
        latency: 'prototypes/latency/index.html',
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
  fmt: {
    singleQuote: true,
    // Docs keep their hand formatting; assistant skills and tool output are not ours to format
    ignorePatterns: ['**/*.md', ...TOOLING_DIRS],
  },
  lint: {
    ignorePatterns: [...TOOLING_DIRS],
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    rules: { 'vite-plus/prefer-vite-plus-imports': 'error' },
    options: { typeAware: true, typeCheck: true },
  },
});
