# AGENTS.md

本文件写给参与本项目的 AI 编程助手（Claude Code、Codex、Cursor 等）和新加入的协作者。开始任何工作前请先通读本文件，再查看 `memory/MEMORY.md`。

## 项目简介

**rhythm2000s** 是一款节奏游戏，玩法完全仿照《节奏天国》（Rhythm Heaven），题材换成 21 世纪初的电脑与网络文化。

- **核心玩法（call & response）**：游戏先示范一段带节拍的动作，玩家随后按相同节奏重复同样的动作。
- **已确定的场景**：
  - Windows XP 桌面
  - 2000 年前后的 Mac 桌面（Mac OS 9 / 早期 Mac OS X Aqua 风格）
- **动作示例**：跟着节奏弹出窗口、关闭窗口、收邮件、点击刷新等。

详细设计见 [doc/game-design.md](doc/game-design.md)。

## 当前阶段

**设计阶段，技术栈已确定**（见 [ADR 0001](doc/decisions/0001-技术栈选型.md)），工程脚手架尚未搭建。

- 只使用已确定的技术栈；要引入新的运行时依赖（尤其是音频、渲染、状态管理类库）前，先向用户说明理由和取舍。
- 下一步计划是做最小延迟测试原型，验证 [doc/tech-research.md](doc/tech-research.md) 第 5 节列出的风险。

## 目录结构

```
.
├── AGENTS.md          # 本文件：给 AI 助手和协作者的项目说明
├── CLAUDE.md          # Claude Code 入口，引用本文件
├── README.md
├── doc/               # 设计与技术文档（人和 AI 都要读）
│   ├── README.md      # 文档索引与写作约定
│   ├── game-design.md # 游戏设计总览
│   ├── tech-research.md # 技术调研：浏览器能力、方案对比、待验证风险
│   ├── scenes/        # 各关卡/场景的设计
│   └── decisions/     # 决策记录（ADR）
└── memory/            # LLM 共享记忆：跨会话保存的项目背景、偏好与约定
    ├── README.md      # 记忆的格式与维护规则
    └── MEMORY.md      # 记忆索引
```

## 技术栈

Web 优先，以浏览器为主要运行平台；需要上架 Steam 时再用 Electron 套壳。详见 [ADR 0001](doc/decisions/0001-技术栈选型.md)。

| 部分 | 选择 | 说明 |
| --- | --- | --- |
| 语言 | TypeScript | |
| 工具链 | [Vite+](https://viteplus.dev/guide)（npm 包名 `vite-plus`） | 统一提供开发服务器（Vite）、构建（Rolldown）、测试（Vitest）、代码检查（Oxlint）、格式化（Oxfmt）；所有配置写在根目录 `vite.config.ts`，从 `vite-plus` 导入 `defineConfig`。不要再单独安装 ESLint、Prettier、Jest 等同类工具 |
| 渲染 | PixiJS（npm 包名 `pixi.js`） | 负责游戏画面；菜单、设置等界面可用 DOM |
| 音频 | 原生 Web Audio API | 自写「指挥」模块，负责拍点换算、预约播放和判定；不用 Howler.js 之类的播放封装 |
| 包管理器 | pnpm | 由 Vite+ 根据 `package.json` 的 `packageManager` 字段和锁文件自动调用 |
| 运行环境 | Node.js 24 | 2026-10-24 本机版本 |

音频与输入时序的实现原则（详见 [doc/tech-research.md](doc/tech-research.md) 第 2 节）：

- 所有声音用 `AudioBufferSourceNode.start(when)` 按音频时钟预约播放。
- 判定使用输入事件的 `event.timeStamp`，通过 `AudioContext.getOutputTimestamp()` 换算到音频时间轴，再扣除 `outputLatency` 和玩家校准值。
- 每帧画面根据当前音频时间计算，不累加帧间隔。

## 常用命令

> 脚手架尚未搭建，以下命令在搭建后生效；如有变化请同步修改。

```bash
vp install     # 安装依赖（内部调用 pnpm）
vp dev         # 启动开发服务器
vp build       # 构建到 dist/
vp preview     # 本地预览构建结果
vp test        # 运行测试（Vitest）
vp check       # 格式、代码检查、类型检查一起跑；加 --fix 自动修复
vp add <包名>  # 添加依赖
vp run <脚本>  # 运行 package.json 中的自定义脚本
```

- `dev`、`build`、`test` 等内置命令不读取 `package.json` 的 scripts；自定义脚本要用 `vp run`。
- 需要全局安装 `vp` 命令（见 [Vite+ 文档](https://viteplus.dev/guide)）；没有全局安装时，可以在项目里用 `pnpm exec vp <命令>` 调用本地的 `vite-plus`。

## 术语

| 术语 | 含义 |
| --- | --- |
| 示范段（call） | 游戏演示动作与节奏的段落，玩家只听和看 |
| 跟打段（response） | 玩家重复示范动作与节奏的段落 |
| 拍（beat） | 以 BPM 为基础的时间单位；谱面时间一律以拍为单位记录，不直接写毫秒 |
| 动作（action） | 一个可判定的玩家输入，如「关闭窗口」「点击刷新」 |
| 判定窗口 | 输入时间与目标拍点之间允许的误差范围，分 Perfect / Good / Miss 等级别 |
| 谱面（chart） | 一首曲子中所有示范与跟打事件的时间表 |
| 场景（scene） | 一个主题小游戏，如「Windows XP 桌面」 |

## 工作约定

1. **语言**：文档、注释、提交说明默认使用中文；代码标识符使用英文。
2. **文档先行**：新增或修改玩法、场景、判定规则时，先更新 `doc/` 中的相关文档，再写代码。
3. **记录决策**：选型、架构、关键玩法规则等重要决定，在 `doc/decisions/` 新建一条 ADR。
4. **节奏时间**：判定和动画必须以音频时钟为准，不能依赖帧计数或 `setTimeout` 之类的计时器（具体实现方式随技术栈确定）。
5. **小步提交**：每次提交只做一件事，提交说明写清楚「做了什么、为什么」。提交说明和 PR 描述中**不要**加 `Co-Authored-By` 或「Generated with ...」之类的 AI 署名。
6. **不臆造**：对需求不确定时先问用户，不要自行补全设计细节并当作已定事项写进文档。

## 素材与版权

本项目模仿 Windows XP 与经典 Mac OS 的视觉风格。微软和苹果的原版素材（壁纸、图标、系统音效、字体、Logo）受版权和商标保护。

- **不要**直接把原版系统素材提交到仓库。
- 美术与音效应原创，做到「一看就是那个年代」，但不是像素级复制。
- 如需临时占位素材，放在被忽略的本地目录中，并在文档里注明。

## LLM 记忆目录（memory/）

`memory/` 保存需要跨会话、跨助手共享的项目背景，例如用户偏好、已确认的约定，以及无法从代码和文档中直接看出的上下文。

- 开始工作时：先读 `memory/MEMORY.md` 索引，再按需读取具体条目。
- 获得值得长期保留的信息时（用户纠正、确认的偏好、项目约束等）：按 `memory/README.md` 的格式新建或更新条目，并更新索引。
- 能从代码、`doc/` 或 git 历史中得到的信息，**不要**重复写进记忆。
- 发现记忆过时或错误时，直接修正或删除。
