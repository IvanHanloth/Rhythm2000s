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
| `responseGapBeats` | 数字（可选） | 示范小节结束后、跟打小节开始前空几拍，不小于 0。**不写时为 0**（2026-10-24 用户把所有谱面的空档改成 0，跟打紧接着示范）。乐句可以单独覆盖 |
| `phrases` | 数组 | 乐句，至少一个，按顺序演奏 |

### 乐句

每个乐句依次是：示范小节 → 空档（`responseGapBeats` 拍）→ 跟打小节。乐句之间没有间隔，下一个乐句的示范小节紧接着上一个乐句的跟打小节。

空档是给玩家准备的时间：「Your turn」提示已经显示，示范小节留下的画面（如弹出的窗口）留在屏幕上；伴奏在空档里只留踩镲，底鼓和军鼓停下。示范小节和跟打小节的鼓点各自从小节第 1 拍重新开始，所以即使空档不是整拍（比如 0.5 拍），跟打小节的拍子也和鼓点对齐。

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

有的动作要按两下（见下面动作表的「跟打段」一列，例如 `desktop-refresh`），或者判定点不在事件拍位置上（`progress-download` 要等 2 拍）。这种事件从 `beat` 一直占到最后一下：

- 下一个事件的 `beat` 必须在这个事件的最后一下之后；
- 最后一下也必须落在小节之内（小于 `beatsPerBar`）。

### 动作 ID

动作 ID 是**示范段出现的界面部件**，按原版系统的类名或常量名取名（[ADR 0006](decisions/0006-动作按界面部件类名命名.md)）：

- 写成 `<部件>-<变体>`，全小写、连字符分隔，如 `dialog-info`。
- 部件和变体取自原版：XP 消息框的图标常量 `MB_ICONINFORMATION` → `dialog-info`，`MB_ICONERROR` → `dialog-error`。名字与 `assets/reference/` 里对应图标的文件名保持一致。
- 不要按动词命名（不再用 `close-window` 这类名字）；玩家在跟打段要对部件做什么，写在下表「跟打段」一列。

| 动作 ID | 部件 | 支持的场景 | 示范段 | 跟打段 |
| --- | --- | --- | --- | --- |
| `dialog-info` | 信息消息框（蓝色 i 图标） | `windows-xp` | 在拍点上弹出，响 XP「星号」提示音 | 在拍点上关掉 |
| `dialog-warning` | 警告消息框（黄色感叹号图标） | `windows-xp` | 在拍点上弹出，响 XP「感叹号」提示音 | 在拍点上关掉 |
| `dialog-error` | 错误消息框（红色叉号图标） | `windows-xp` | 在拍点上弹出，响 XP「严重停止」提示音 | 在拍点上关掉 |
| `dialog-question` | 询问消息框（问号图标，按钮是「是」「否」） | `windows-xp` | 在拍点上弹出，暂用 `chimes.wav`（原版的「问题」事件没有声音，见 [scenes/windows-xp.md](scenes/windows-xp.md#音效)） | 在拍点上关掉 |
| `desktop-refresh` | 桌面右键菜单（菜单窗口类 `#32768`）里的「刷新(E)」 | `windows-xp` | 虚拟鼠标在拍点上右键桌面，弹出右键菜单；**0.5 拍后**点「刷新」，桌面图标闪一下 | 按两下：拍点上一下（右键），0.5 拍后再一下（刷新） |
| `balloon-info` | 托盘气泡（`Shell_NotifyIcon` 的 `NIIF_INFO`） | `windows-xp` | 在拍点上从托盘冒出气泡，响 `Windows XP Balloon.wav` | 在拍点上点气泡的关闭按钮 |
| `window-minimize` | 程序窗口的最小化按钮（`SC_MINIMIZE`） | `windows-xp` | 在拍点上弹出记事本、画图等程序窗口，任务栏多一个按钮，响 `Windows XP Restore.wav` | 在拍点上把它最小化到任务栏，响 `Windows XP Minimize.wav` |
| `start-menu` | 开始菜单 | `windows-xp` | 虚拟鼠标在拍点上按「开始」弹出菜单；**0.5 拍后**点一个程序，菜单收起 | 按两下：拍点上一下（开始），0.5 拍后再一下（菜单项） |
| `recycle-bin` | 回收站（`SHFileOperation` 的 `FO_DELETE`） | `windows-xp` | 在拍点上桌面落下一个文件，响 `Windows XP Default.wav`（暂定） | 在拍点上把它扔进回收站，响 `Windows XP Recycle.wav` |
| `progress-download` | IE6 文件下载进度窗（`msctls_progress32`） | `windows-xp` | 在拍点上弹出，进度条走 **2 拍**，走满时虚拟鼠标点「Open」 | 下载窗同一拍自动弹出；在**拍点后 2 拍**（进度条走满）点一下 |
| `volume-mute` | 托盘音量控制（`msctls_trackbar32`），只是画面，不改实际音量 | `windows-xp` | 拍点前滑块掉到底；虚拟鼠标在拍点上按住滑块，**1 拍**后在拍点上松开 | 长按：拍点上按下，按住 1 拍，在拍点上松开；按下、松开各判一次 |
| `alert-note` | Mac 提示框（`kAlertNoteAlert`，程序图标） | `mac-2000` | 在拍点上弹出，响 `Glass` | 在拍点上按「好」关掉 |
| `alert-caution` | Mac 警告提示框（`kAlertCautionAlert`，黄色三角） | `mac-2000` | 在拍点上弹出，响 `Funk` | 同上 |
| `alert-stop` | Mac 停止提示框（`kAlertStopAlert`） | `mac-2000` | 在拍点上弹出，响 `Basso` | 同上 |
| `dock-bounce` | Dock 图标弹跳（`requestUserAttention:`） | `mac-2000` | 图标跳起，在拍点上落下，响 `Pop`，之后一直小幅弹跳 | 在拍点上点一下，让它停下 |
| `mail-new` | Mail 新邮件（Dock 图标的未读角标） | `mac-2000` | Mail 图标轻跳一下，角标加 1，响 `Ping` | 在拍点上读一封，角标减 1 |
| `window-miniaturize` | Mac 文稿窗口（`NSWindow miniaturize:`） | `mac-2000` | 在拍点上弹出窗口，响 `Bottle` | 在拍点上把它最小化到 Dock |
| `menu-apple` | Mac 苹果菜单（`NSMenu`，菜单栏最左边的苹果） | `mac-2000` | 虚拟鼠标在拍点上点苹果，菜单落下，响 `Morse`；**0.5 拍后**点一个菜单项，响 `Tink`，菜单收起 | 按两下：拍点上一下（苹果），0.5 拍后再一下（菜单项） |
| `dock-trash` | Dock 上的废纸篓（`NSWorkspaceRecycleOperation`） | `mac-2000` | 在拍点上 Dock 上方落下一个文件，响 `Purr` | 在拍点上把它扔进废纸篓，响 `Blow`，废纸篓由空变满 |

四种消息框玩法相同，只是图标、按钮和提示音不同，同一乐句里可以混用。`desktop-refresh` 也可以和消息框混用；它的第二下固定在第一下之后 0.5 拍（2026-10-24 用户选定：一个事件、固定间隔），谱面里只写第一下的拍位置。`balloon-info`、`window-minimize`、`start-menu`、`recycle-bin` 是 2026-10-24 加的四个 XP 动作，同样可以和其他 XP 动作混用，`start-menu` 的两下和 `desktop-refresh` 一样固定相隔 0.5 拍，设计见 [scenes/windows-xp-levels.md](scenes/windows-xp-levels.md)。`progress-download`、`volume-mute` 同样是固定间隔（判定点分别在 +2 拍和 0、+1 拍），设计见 [scenes/windows-xp-levels.md](scenes/windows-xp-levels.md#等待与长按下载进度窗音量控制2026-10-24)；`volume-mute` 的第二下是「松开」，玩家要从第一下一直按住。Mac 场景的动作也一样，玩法相同，同一乐句里可以混用（Mac 提示音的选择见 [scenes/mac-2000.md](scenes/mac-2000.md#音效)）；`menu-apple` 的两下和 `start-menu` 一样固定相隔 0.5 拍。设计文档里的其他动作（XP 的收邮件等）实现后再按同样规则加入此表。谱面用了所在场景不支持的动作，视为错误。

## 官方关卡的要求

官方关卡还要符合 [level-design.md](level-design.md)：从简单到难、正文至少 1 分钟。开头的操作演示由系统按谱面里出现的动作自动生成，**不要写进谱面**。

## 场景附加规则

| 场景 | 规则 |
| --- | --- |
| `windows-xp` | 每个乐句的 `response` 与 `call` 事件个数相同、动作依次相同：第几个弹出的消息框，就由第几下关掉。另外同一乐句里消息框和程序窗口合计不超过 6 个，`window-minimize` 不超过 4 个，`balloon-info` 不超过 3 个，`recycle-bin` 不超过 6 个（[原因](scenes/windows-xp-levels.md#每个乐句的上限)） |
| `mac-2000` | 同上：第几个出现的提示框 / 弹跳图标 / 新邮件 / 窗口 / 菜单 / 文件，就由第几下处理。另外同一乐句里提示框和文稿窗口合计不超过 6 个，`dock-bounce` 不超过 8 个，`dock-trash` 不超过 6 个（画面上的位置和 Dock 图标就这么多） |

## 时间上的限制

「Follow me / Your turn」提示会在示范小节、跟打小节结束前半拍切换（见 [prototypes/mvp.md](prototypes/mvp.md#轮次提示2026-10-24-用户要求加入)），所以这两种小节里最后一下的 Good 判定窗口必须在小节结束前半拍之前关闭。120 BPM、Good ±100 毫秒时，最后一下最晚在第 3.25 拍；要按两下的 `desktop-refresh`、`start-menu`、`menu-apple` 最晚放在第 2.75 拍（第二下在 3.25 拍），`volume-mute` 最晚放在第 2.25 拍，`progress-download` 最晚放在第 1.25 拍。加载谱面时会检查，不满足的谱面视为错误。

## 校验与报错

游戏启动时逐个校验，出错的谱面会被跳过，错误打印在浏览器控制台，带字段路径，例如：

```
谱面 xp-popup-mvp.json：phrases[2].call[1].beat 必须大于上一个事件的拍位置
```
