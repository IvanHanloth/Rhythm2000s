# 谱面格式

> 状态：草稿（2026-10-24，格式版本 1；同日动作 ID 改为按界面部件命名）
>
> 决策记录见 [ADR 0003](decisions/0003-谱面数据格式.md)。

## 文件位置

```
public/charts/
├── index.json          # 谱面清单
└── xp-popup-mvp.json   # 一首谱面一个文件，文件名 = 谱面 id + .json
```

游戏启动时下载 `index.json`，再下载其中列出的每个谱面并校验。改了谱面文件，刷新页面即可生效，不需要重新构建。

### index.json

```json
{
  "format": 1,
  "charts": ["xp-popup-mvp.json"]
}
```

## 谱面文件

```json
{
  "format": 1,
  "id": "xp-popup-mvp",
  "title": "弹窗大扫除",
  "scene": "windows-xp",
  "bpm": 120,
  "beatsPerBar": 4,
  "countInBars": 1,
  "outroBars": 1,
  "phrases": [
    {
      "call": [
        { "beat": 0, "action": "dialog-info" },
        { "beat": 1, "action": "dialog-warning" },
        { "beat": 2, "action": "dialog-error" }
      ]
    },
    {
      "responseGapBeats": 4,
      "call": [
        { "beat": 0, "action": "dialog-info" },
        { "beat": 1, "action": "dialog-info" }
      ],
      "response": [
        { "beat": 0, "action": "dialog-info" },
        { "beat": 1.5, "action": "dialog-info" }
      ]
    }
  ]
}
```

### 顶层字段

除标明「可选」的字段外都必填；出现未定义的字段视为错误（防止拼错字段名后被悄悄忽略）。

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `format` | 整数 | 格式版本，目前是 `1` |
| `id` | 字符串 | 谱面标识，只用小写字母、数字和连字符，必须与文件名一致 |
| `title` | 字符串 | 显示给玩家的曲名 |
| `scene` | 字符串 | 所属场景：`windows-xp` 或 `mac-2000` |
| `bpm` | 数字 | 每分钟拍数，大于 0 |
| `beatsPerBar` | 整数 | 每小节几拍，大于 0 |
| `countInBars` | 整数 | 开头预备几小节，不小于 0 |
| `outroBars` | 整数 | 结尾留空几小节，不小于 0 |
| `responseGapBeats` | 数字（可选） | 示范小节结束后、跟打小节开始前空几拍，不小于 0。**不写时为 0.5 拍**。乐句可以单独覆盖 |
| `phrases` | 数组 | 乐句，至少一个，按顺序演奏 |

### 乐句

每个乐句依次是：示范小节 → 空档（`responseGapBeats` 拍）→ 跟打小节。乐句之间没有间隔，下一个乐句的示范小节紧接着上一个乐句的跟打小节。

空档是给玩家准备的时间：「Your turn」提示已经显示，示范小节留下的画面（如弹出的窗口）留在屏幕上；伴奏在空档里只留踩镲，底鼓和军鼓停下。示范小节和跟打小节的鼓点各自从小节第 1 拍重新开始，所以即使空档不是整拍（比如默认的 0.5 拍），跟打小节的拍子也和鼓点对齐。

| 字段 | 必填 | 含义 |
| --- | --- | --- |
| `call` | 是 | 示范小节里的事件，至少一个 |
| `response` | 否 | 跟打小节里的事件（玩家要按的目标），至少一个。**不写时与 `call` 完全相同** |
| `responseGapBeats` | 否 | 这个乐句的空档拍数，覆盖顶层的值 |

### 事件

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `beat` | 数字 | 相对**所在小节开头**的拍位置，从 0 开始，必须小于 `beatsPerBar`。可以是小数，如 `1.5` 表示第 2 拍的反拍 |
| `action` | 字符串 | 动作 ID，见下表 |

同一小节里的事件必须按 `beat` 从小到大排列，不能重复。

### 动作 ID

动作 ID 是**示范段出现的界面部件**，按原版系统的类名或常量名取名（[ADR 0005](decisions/0005-动作按界面部件类名命名.md)）：

- 写成 `<部件>-<变体>`，全小写、连字符分隔，如 `dialog-info`。
- 部件和变体取自原版：XP 消息框的图标常量 `MB_ICONINFORMATION` → `dialog-info`，`MB_ICONERROR` → `dialog-error`。名字与 `assets/reference/` 里对应图标的文件名保持一致。
- 不要按动词命名（不再用 `close-window` 这类名字）；玩家在跟打段要对部件做什么，写在下表「跟打段」一列。

| 动作 ID | 部件 | 支持的场景 | 示范段 | 跟打段 |
| --- | --- | --- | --- | --- |
| `dialog-info` | 信息消息框（蓝色 i 图标） | `windows-xp` | 在拍点上弹出，响 XP「星号」提示音 | 在拍点上关掉 |
| `dialog-warning` | 警告消息框（黄色感叹号图标） | `windows-xp` | 在拍点上弹出，响 XP「感叹号」提示音 | 在拍点上关掉 |
| `dialog-error` | 错误消息框（红色叉号图标） | `windows-xp` | 在拍点上弹出，响 XP「严重停止」提示音 | 在拍点上关掉 |
| `dialog-question` | 询问消息框（问号图标，按钮是「是」「否」） | `windows-xp` | 在拍点上弹出，暂用 `chimes.wav`（原版的「问题」事件没有声音，见 [scenes/windows-xp.md](scenes/windows-xp.md#音效)） | 在拍点上关掉 |

四种消息框玩法相同，只是图标、按钮和提示音不同，同一乐句里可以混用。设计文档里的其他动作（收邮件、点击刷新等）实现后再按同样规则加入此表。谱面用了所在场景不支持的动作，视为错误。

## 场景附加规则

| 场景 | 规则 |
| --- | --- |
| `windows-xp` | 每个乐句的 `response` 与 `call` 事件个数相同、动作依次相同：第几个弹出的消息框，就由第几下关掉 |

## 时间上的限制

「Follow me / Your turn」提示会在示范小节、跟打小节结束前半拍切换（见 [prototypes/mvp.md](prototypes/mvp.md#轮次提示2026-10-24-用户要求加入)），所以这两种小节里最后一个事件的 Good 判定窗口必须在小节结束前半拍之前关闭。120 BPM、Good ±100 毫秒时，最后一个事件最晚放在第 3.25 拍。加载谱面时会检查，不满足的谱面视为错误。

## 校验与报错

游戏启动时逐个校验，出错的谱面会被跳过，错误打印在浏览器控制台，带字段路径，例如：

```
谱面 xp-popup-mvp.json：phrases[2].call[1].beat 必须大于上一个事件的拍位置
```
