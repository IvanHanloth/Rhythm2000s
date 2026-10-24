# 技术调研：渲染平台与技术栈

> 状态：草稿（2026-10-24）
>
> 结论摘要：**浏览器完全能支撑《节奏天国》式玩法**，建议「Web 优先，需要上架 Steam 时再套桌面壳」。2026-10-24 已采纳 TypeScript + PixiJS + Vite+，见 [ADR 0001](decisions/0001-技术栈选型.md)。

## 1. 这款游戏对技术的真实要求

先把需求拆开，才能判断浏览器够不够用：

| 需求 | 说明 | 难度 |
| --- | --- | --- |
| 音频时钟精确 | 示范段的提示音、伴奏、判定音效必须对齐到拍点 | 关键 |
| 输入时间精确 | 要知道玩家按键/点击「发生在音频时间轴的哪一刻」，而不是「JS 什么时候收到」 | 关键 |
| 延迟校准 | 扬声器、蓝牙耳机、显示器都有延迟，必须让玩家校准 | 关键（任何平台都要做） |
| 2D 动画 | 窗口弹出/关闭、角色挤压拉伸、粒子；画面要跟音频时钟走 | 中等 |
| 输入种类少 | 《节奏天国》式玩法只需 1～3 个按键或鼠标点击 | 简单 |
| 不需要控制真实系统 | 「XP 桌面」「Mac 桌面」都是游戏里画出来的，不是操作真实窗口 | — |

没有的需求：3D、物理引擎、大量同屏物体、联网对战、毫秒级极限判定（像 osu! 那种）。《节奏天国》的判定窗口相对宽松，玩法重在「听懂节奏」，这一点对平台选择很有利。

## 2. 浏览器能不能满足？逐项检查

### 2.1 音频调度 —— 满足

Web Audio API 有自己独立的音频时钟 `AudioContext.currentTime`，以采样为精度运行，不受主线程卡顿影响。

- 用 `AudioBufferSourceNode.start(when)` 可以把提示音预约到未来某个精确时刻播放，误差是采样级的。
- 这正好符合 AGENTS.md 第 4 条「以音频时钟为准，不依赖帧计数或 `setTimeout`」。
- 做法：用一个「指挥（Conductor）」模块，把谱面中以拍为单位的事件换算成音频时钟时间，提前一小段时间（例如提前一两拍）预约播放。

### 2.2 输入时间戳 —— 满足

- 键盘、鼠标、触摸事件都带 `event.timeStamp`，是高精度时间戳（与 `performance.now()` 同一时间轴），记录的是事件发生时刻，而不是回调执行时刻。所以即使主线程正忙，输入时间也不会被「拖后」。
- `AudioContext.getOutputTimestamp()` 会同时返回一对 `{contextTime, performanceTime}`，用它就能把 `event.timeStamp` 换算到音频时间轴上，再和目标拍点比较。
- `AudioContext.outputLatency` 给出音频硬件输出延迟的估计。Chrome/Edge 102、Firefox 70、Safari 18.4 起支持（[web.dev](https://web.dev/articles/audio-output-latency)、[caniuse](https://caniuse.com/mdn-api_audiocontext_outputlatency)），现在主流浏览器都能用。

判定公式（示意）：

```
输入的音频时间 = 把 event.timeStamp 换算到 AudioContext 时间轴
误差 = 输入的音频时间 − 目标拍点的音频时间 − 输出延迟 − 玩家校准值
```

### 2.3 延迟 —— 和原生客户端差别不大

- 输出延迟主要由声卡缓冲、系统混音器、蓝牙耳机决定。蓝牙耳机可能超过 100 毫秒（[参考](https://bugnet.io/blog/bug-tracking-for-rhythm-and-music-games)），这在原生客户端里也一样存在。
- 原生客户端能通过 WASAPI 独占模式、ASIO 等进一步降低延迟，但那是 osu! 这类极限判定游戏才需要的。对本项目来说，**校准比绝对延迟更重要**，而校准在浏览器里同样能做。
- 校准界面的常见做法：让玩家跟着节拍点按若干次，取中位数并去掉极端值（[Rhythm Quest 开发者讨论](https://itch.io/post/9879297)）。

### 2.4 画面 —— 满足

- 画面帧率由 `requestAnimationFrame` 驱动，每帧读取音频时钟来决定动画位置，**不累加帧间隔**。偶尔掉帧只会让画面跳一下，不影响判定（判定只看输入时间戳）。
- 2D 渲染用 Canvas/WebGL（例如 PixiJS）完全够用；复古桌面界面的文字、窗口、按钮也很适合。

### 2.5 浏览器真正的限制

| 限制 | 影响 | 应对 |
| --- | --- | --- |
| 自动播放策略：用户点击之前不能出声 | 进入游戏前必须有一次点击 | 标题界面「点击开始」，顺便恢复 `AudioContext` |
| 标签页切到后台会被降频 | 后台时画面和计时会被打乱 | 监听 `visibilitychange`，失焦即暂停 |
| 部分系统快捷键无法拦截（Win 键、Ctrl+W 等） | 不能用这些键当游戏按键 | 本来只用少数按键，避开即可 |
| 右键菜单、拖拽选中文字 | 鼠标玩法会误触 | 阻止 `contextmenu`、`selectstart` 默认行为 |
| 不同浏览器、设备的延迟不同 | 判定体验不一致 | 校准 + 分平台实测 |
| 无法接入 Steam 成就、云存档 | 只有上架 Steam 时才需要 | 用桌面壳解决（见第 4 节） |

**结论：没有发现「浏览器做不到、必须改用客户端」的硬性障碍。** 需要客户端的理由只会来自发行渠道（Steam），而不是交互能力。

## 3. 候选技术方案对比

| 方案 | 优点 | 缺点 | 适合度 |
| --- | --- | --- | --- |
| **A. TypeScript + 原生 Web Audio + PixiJS（Vite 构建）** | 音频时钟完全可控；包体小、加载快；网页直接玩，传播成本最低；之后套桌面壳几乎不用改代码；复古 UI 适合用 Web 技术实现 | 没有可视化编辑器，关卡动画、场景编排要靠代码或自制工具；音频「指挥」模块要自己写 | ★★★★★ |
| B. Godot 4（导出 Web + 原生） | 有编辑器和动画工具，美术协作友好；同一工程可导出 Windows/Mac/Web/移动端；4.3 起 Web 单线程导出成为默认，在 macOS/iOS 上可用，Web 平台用 Web Audio 的 Sample 模式可以做到低延迟（[Godot 4.5 文档](https://docs.godotengine.org/en/4.5/tutorials/export/exporting_for_web.html)） | Web 包体大、首屏加载慢；Sample 模式不支持音频效果器等功能；Web 平台上的音频同步精度没有找到实测资料，需要自己验证；音频时钟要经过引擎一层抽象，不如方案 A 直接 | ★★★★ |
| C. Unity（WebGL + 原生） | 生态成熟，同类游戏多（很多节奏游戏用 Unity） | WebGL 平台音频只支持基础功能（FMOD 依赖线程，WebGL 下改用 Web Audio）（[Unity 文档](https://docs.unity3d.com/cn/2022.3/Manual/webgl-audio.html)）；包体大；对这种 2D 小游戏偏重 | ★★ |
| D. 纯原生客户端（如 C++/SDL、Rust、MonoGame） | 延迟可以压到最低 | 放弃网页传播；开发成本高；对本玩法来说收益不明显 | ★ |
| F. PocketJS（Solid/Vue 组件 + QuickJS + Rust 核心） | 用组件 + flexbox + Tailwind 子集写界面，做复古窗口很顺手；动画由 Rust 核心驱动，内存占用极小；能跑在 PSP、3DS 等老硬件上（[GitHub](https://github.com/pocket-stack/pocketjs)） | 定位是嵌入式/掌机 UI 运行时，不是浏览器游戏渲染库；输入按帧批量传入，文档未提供事件时间戳，判定精度会被量化到帧；音频只有一个「PCM 混音器」模块，未说明 API、延迟和时钟；动画跑在引擎自己的时钟上，不是音频时钟；未列出现代 Windows 桌面宿主；项目较新 | ★（不适合做主引擎） |
| E. 纯 DOM/CSS 渲染 | 复古窗口、字体、按钮用 HTML/CSS 最容易做 | 大量动画时性能和时序难控；角色挤压拉伸、特效不方便 | 可作为菜单/UI 层，与 A 搭配 |

### 方案 A 的具体组成（提议）

- **语言**：TypeScript
- **构建**：Vite（后改为 Vite+，见 ADR 0001）
- **渲染**：PixiJS（WebGL 2D，游戏画面）；菜单、设置等界面可以用 DOM
- **音频**：直接使用 Web Audio API，自己写一个小型「指挥」模块负责拍点换算、预约播放和判定。不使用 Howler.js 这类封装（它们主要解决「播放一个声音」，不擅长精确预约）。Tone.js 的 Transport 也能做调度，但体积大、抽象层多，可以在原型阶段对比后再决定
- **谱面格式**：JSON，时间以拍为单位（符合文档约定）
- **测试**：Vitest，重点测「拍 ↔ 音频时间」换算和判定逻辑

## 4. 如果之后需要桌面客户端

方案 A 的代码可以直接套壳，不需要重写：

| 壳 | 内核 | 说明 |
| --- | --- | --- |
| **Electron** | 自带 Chromium | 各平台的音频和渲染行为一致，最省心；Steam 接入有现成库（如 steamworks.js）；包体约百 MB |
| Tauri 2 | 系统自带 WebView（Windows 用 WebView2/Chromium，macOS 用 WKWebView/WebKit） | 包体小；但 macOS 上实际跑的是 Safari 内核，音频表现与 Windows 不同，需要单独测试 |

建议：真到要上架 Steam 时优先考虑 Electron，换取跨平台一致性；如果很在意包体，再评估 Tauri。

移动端：网页可以直接在手机浏览器里玩（触摸点按和《节奏天国》掌机版很接近），之后也可以用 Capacitor 打包。但手机浏览器的触摸和音频延迟需要实测。

## 5. 需要原型验证的风险

技术栈确定后，第一件事建议是做一个**最小延迟测试原型**，回答以下问题：

1. Windows（Chrome/Edge/Firefox）和 macOS（Safari/Chrome）上，`outputLatency` 报告的数值与实测是否接近。
2. `event.timeStamp` 换算到音频时间轴后，键盘、鼠标、触摸三种输入的误差分布如何。
3. 鼠标点击玩法（需要先把鼠标移到目标上）对节奏判定的影响有多大——这关系到 [game-design.md](game-design.md) 里的「输入方式」待定问题。
4. 蓝牙耳机场景下，校准流程能否把体验拉回可玩范围。
5. Safari 上 `getOutputTimestamp()` 是否正常。有开发者报告过 iOS 15.1 上返回值异常（[Apple 开发者论坛](https://developer.apple.com/forums/thread/696356)），需要在当前版本上复查。

## 参考资料

- [web.dev：Synchronize audio and video playback on the web](https://web.dev/articles/audio-output-latency)
- [caniuse：AudioContext.outputLatency](https://caniuse.com/mdn-api_audiocontext_outputlatency)
- [MDN：AudioContext.outputLatency](https://developer.mozilla.org/docs/Web/API/AudioContext/outputLatency)
- [Godot 4.5：Exporting for the Web](https://docs.godotengine.org/en/4.5/tutorials/export/exporting_for_web.html)
- [Godot：Web export in 4.3 进展报告](https://godotengine.org/article/progress-report-web-export-in-4-3/)
- [PocketJS（GitHub）](https://github.com/pocket-stack/pocketjs)
- [Unity：WebGL 音频](https://docs.unity3d.com/cn/2022.3/Manual/webgl-audio.html)
- [Apple 开发者论坛：getOutputTimestamp 问题](https://developer.apple.com/forums/thread/696356)
- [Rhythm Quest 开发者关于校准的讨论](https://itch.io/post/9879297)
- [节奏游戏的延迟与测试](https://bugnet.io/blog/bug-tracking-for-rhythm-and-music-games)
