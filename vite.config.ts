import { defineConfig } from 'vite-plus';

/** AI 助手和工具生成的目录，不参与格式化和代码检查 */
const TOOLING_DIRS = ['.agents/**', '.claude/**', '.playwright-mcp/**'];

export default defineConfig({
  build: {
    rolldownOptions: {
      // 多页面：游戏入口 + 各个原型页面（相对项目根目录）
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
