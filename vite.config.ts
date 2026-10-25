import { defineConfig } from 'vite-plus';

/** Import aliases, mirrored in tsconfig.json `paths` */
const alias = { '@/': '/src/', '@assets/': '/assets/', '@public/': '/assets/public/' };

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
  // Fetched at runtime by URL and copied to dist as they are (charts, models, textures); the rest of assets/ is imported
  publicDir: 'assets/public',
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
