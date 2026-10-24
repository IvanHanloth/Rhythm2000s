import { defineConfig } from 'vite-plus';

/** Import aliases, mirrored in tsconfig.json `paths` */
const alias = { '@/': '/src/', '@assets/': '/assets/', '@public/': '/public/' };

/**
 * 不参与格式化和代码检查的文件：AI 助手和工具生成的目录、技能包锁文件，
 * 以及独立维护的宣发视频工程 promo/（有自己的工具链，见 promo/AGENTS.md）
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
      // 多页面：游戏入口 + 各个原型页面（相对项目根目录）
      input: {
        main: 'index.html',
        latency: 'prototypes/latency/index.html',
        xpComponents: 'prototypes/xp-components/index.html',
        macComponents: 'prototypes/mac-components/index.html',
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
  fmt: {
    singleQuote: true,
    // 文档保持手写格式；AI 助手的技能包和工具产物不归本项目管
    ignorePatterns: ['**/*.md', ...TOOLING_DIRS],
  },
  lint: {
    ignorePatterns: [...TOOLING_DIRS],
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    rules: { 'vite-plus/prefer-vite-plus-imports': 'error' },
    options: { typeAware: true, typeCheck: true },
  },
});
