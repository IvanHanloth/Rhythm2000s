# 场景：Windows XP 桌面

> 状态：草稿

## 视觉基调

蓝天绿草风格的壁纸、蓝色任务栏、绿色「start」按钮、圆角蓝色标题栏窗口。（界面尽量贴近原版，可以直接使用 `assets/reference/windows-xp/` 的原版素材，见 [ADR 0004](../decisions/0004-authentic-os-look.md)。）

## 界面部件（2026-10-24 重新设计）

用户要求桌面、开始菜单、消息框、托盘、音量控制「尽可能还原 Windows 原版」。参照对象是**美国英文版 Windows XP SP2、Luna 蓝色主题**，界面文字用英文版的说法（「start」「OK」「All Programs」「Log Off」「Turn Off Computer」）。2026-10-24 用户要求玩家看到的文字一律用英文，参照对象从原来的简体中文版改成英文版，菜单不再带「(F)」这类中文版的访问键括号。

### 尺寸

- 部件按原版的像素尺寸绘制（标题栏、按钮、任务栏 30 像素高等），整块桌面放大 1.25 倍铺满 1280×720 的画布，相当于一台 **1024×576** 分辨率的 XP。放大倍数是暂定值，觉得字小再调。
- Follow me / Your turn 横幅和判定字样不属于 XP 界面，仍按画布坐标绘制。
- 窗口标题栏放不下标题时，和原版一样截断并在末尾加「...」（如程序窗口「about:blank - Microsoft Internet Explorer」）。

### 部件清单

代码在 `src/scenes/windows-xp/components/`，可以在[XP 部件展示页](../../prototypes/xp-components/index.html)（开发面板里的「原型：XP 部件」）逐个点开看效果、听声音。

| 部件 | 原版对应 | 内容 |
| --- | --- | --- |
| 桌面 | 桌面 | Bliss 壁纸（按比例铺满，上下略裁）；左上角一列「My Documents」「My Computer」「My Network Places」（`network-global.png`，开始菜单里也用它）「Internet Explorer」，右下角「Recycle Bin」。图标 32 像素，白字带阴影 |
| 任务栏 | `Shell_TrayWnd` | 30 像素高的蓝色渐变条，左边绿色「start」按钮（英文版是小写斜体粗字，旗帜用 `windows-logo.png`），右边托盘 |
| 开始菜单 | 开始菜单（XP 样式） | 顶部蓝色用户栏（头像 `user.png`）+ 橙色分隔线；左栏白底（Internet、E-mail，常用程序 Windows Media Player、Windows Messenger、Notepad、Paint、Calculator、Minesweeper，「All Programs」）；右栏浅蓝底（My Documents、My Pictures、My Music、My Computer、My Network Places、Printers and Faxes、Help and Support、Search、Run...）；底部蓝条「Log Off」「Turn Off Computer」。鼠标移上去是蓝底白字 |
| 托盘 | `TrayNotifyWnd` | 浅蓝渐变区，网络连接（`network-neighborhood.png`）、Messenger、音量小喇叭（`speaker.png`，静音时叠一个红色禁止符号）、时钟（英文版的 12 小时制，如「5:49 PM」，显示本机时间） |
| 托盘气泡 | 气泡提示（`tooltips_class32` 气泡样式） | 浅黄底圆角气泡，尖角指向托盘图标，标题加粗带图标，右上角关闭按钮 |
| 音量控制 | 单击托盘音量图标弹出的小窗 | 「Volume」标签、竖向滑块（两侧刻度）、「Mute」复选框。松开滑块时按新音量响一声默认提示音，与原版相同 |
| 鼠标指针 | 标准箭头 | XP 场景里画面上的指针换成 `icons/default_arrow.cur`（文件自带热点）。手形指针 `default_link.cur` 原版只用在超链接上，场景里暂时没用 |
| 消息框 | `MessageBox`（窗口类 `#32770`） | Luna 标题栏（活动 / 非活动两种颜色）+ 关闭按钮；左侧 32 像素图标，右侧正文；底部居中按钮，默认按钮带蓝色内框。大小随文字自动调整 |

消息框有四种，对应谱面里的四个动作 ID（[chart-format.md](../chart-format.md#动作-id)）：

| 动作 ID | 原版常量 | 图标 | 按钮 |
| --- | --- | --- | --- |
| `dialog-info` | `MB_ICONINFORMATION` | `icons/dialog-info.png` | OK |
| `dialog-warning` | `MB_ICONWARNING` | `icons/dialog-warning.png` | OK |
| `dialog-error` | `MB_ICONERROR` | `icons/dialog-error.png` | OK |
| `dialog-question` | `MB_ICONQUESTION` | `icons/dialog-question.png` | Yes、No |

消息框文案（标题 / 正文）模仿当年弹窗广告和系统提示的腔调，全部原创，例如「Congratulations! / You are our 100,000th visitor! Click here to claim your prize.」「Low Disk Space / You are running out of disk space on Local Disk (C:).」「Application Error / This program has performed an illegal operation and will be shut down.」「Notepad / The text in the Untitled file has changed. Do you want to save the changes?」，完整列表在 `src/scenes/windows-xp/scene.ts` 的 `POPUP_TEXTS`。

### 选关：资源管理器

进场景先看到资源管理器的关卡列表，用鼠标点选，流程和操作见 [level-select.md](../level-select.md)。

| 部件 | 原版对应 | 内容 |
| --- | --- | --- |
| 资源管理器窗口 | `CabinetWClass` | 标题「My Levels」带文件夹小图标，标题栏右边最小化、最大化、关闭三个按钮；菜单栏「File Edit View Favorites Tools Help」；标准按钮工具栏（Back、前进、向上、Search、Folders、查看）；地址栏「Address」「C:\rhythm2000s\My Levels\XP Desktop」（右边「Go」）；底部状态栏（「N objects」和「Click to select, double-click to play    Esc: back to the café」） |
| 任务窗格 | Web 视图左边的任务窗格 | 蓝紫渐变底，可折叠的分组：「Level Tasks」（Play this level、Back to the café）、「Details」（选中关卡的曲名和 Actions、Tempo、Phrases、Length 四行） |
| 平铺视图 | 「View → Tiles」 | 白底，分组标题「All Levels」，48 像素图标，右边三行字（名称、动作、速度）；选中时名称蓝底白字、图标蒙一层蓝 |
| 任务栏按钮 | 任务栏上的程序按钮 | 「My Levels」；窗口在前面时是按下的深蓝色，开始一局后变回普通的浅蓝色 |

本地没有资源管理器工具栏的原版图标（后退、前进、向上、查看），按原版样子矢量绘制；搜索、文件夹图标用 `icons/search.png`、`icons/folder.png`。

### 音效

全部取自 `assets/reference/windows-xp/sounds/` 的原版文件。加载时自动切掉开头的静音（有的文件开头空了几十毫秒，会让声音听起来晚于拍点），并统一峰值音量。

| 时机 | 原版事件 | 文件 |
| --- | --- | --- |
| `dialog-info` 弹出 | 星号（SystemAsterisk） | `Windows XP Error.wav` |
| `dialog-warning` 弹出 | 感叹号（SystemExclamation） | `Windows XP Exclamation.wav` |
| `dialog-error` 弹出 | 严重停止（SystemHand） | `Windows XP Critical Stop.wav` |
| `dialog-question` 弹出 | 问题（SystemQuestion），**原版默认没有声音** | 暂用 `chimes.wav`，待定 |
| 玩家关掉消息框（Perfect / Good） | 原版关窗没有声音；借用资源管理器「开始导航」的点击声 | `Windows XP Start.wav` |
| Miss | 默认提示音（点到模态对话框外面时响的那一声） | `Windows XP Ding.wav` |
| 一局结束，弹出结果 | — | `tada.wav` |
| 开始菜单里点一项 | 菜单命令 | `Windows XP Menu Command.wav` |
| 音量滑块松开 | 默认提示音 | `Windows XP Ding.wav` |
| 托盘气泡出现 | 系统通知 | `Windows XP Balloon.wav` |
| `desktop-refresh` 第一下：右键弹出菜单（示范段按拍点预约，跟打段命中时播放） | 原版右键、弹出菜单都没有声音；借用「开始导航」的点击声，暂定 | `Windows XP Start.wav` |
| `desktop-refresh` 第二下：点「Refresh」 | 菜单命令，暂定 | `Windows XP Menu Command.wav` |
| `balloon-info` 气泡出现 / 被点掉 | 系统通知 / 借用点击声 | `Windows XP Balloon.wav` / `Windows XP Start.wav` |
| `window-minimize` 窗口弹出 / 最小化 | 还原（RestoreUp）/ 最小化（Minimize） | `Windows XP Restore.wav` / `Windows XP Minimize.wav` |
| `start-menu` 第一下（按「start」）/ 第二下（点菜单项） | 原版没有声音，借用点击声 / 菜单命令 | `Windows XP Start.wav` / `Windows XP Menu Command.wav` |
| `recycle-bin` 文件落下 / 扔进回收站 | 暂定 / 清空回收站（EmptyRecycleBin） | `Windows XP Default.wav` / `Windows XP Recycle.wav` |

「原版事件」一列是按记忆和网上零散资料对的，没有在 XP 原机的注册表（`HKCU\AppEvents\Schemes`）里核对过。

### 虚拟鼠标（2026-10-24 用户要求）

一局里画面上有一个虚拟鼠标指针（XP 标准箭头，`icons/default_arrow.cur` 解码成图片，热点在箭头尖上）在桌面上四处移动、去点东西；它不是玩家自己的鼠标。

已确定（2026-10-24 用户选定）：

- **示范段**：虚拟鼠标自己示范。弹消息框时，它滑到新弹出的消息框上；`desktop-refresh` 由它在拍点上右键桌面、0.5 拍后点「Refresh」。
- **跟打段**：它提前滑到下一个目标上停好，玩家按空格（或点画面）时它在原地点下去。玩家只管节奏，不用瞄准。
- 两下（右键、刷新）都用同一个键：空格或点画面。
- 和选关的约定一样，只有一局进行中时才有虚拟鼠标、才算节奏输入；一局里把玩家自己的鼠标指针藏起来，免得和虚拟鼠标混在一起。

暂定（试玩后再调）：

- 消息框点的是默认按钮（「OK」或「Yes」）的中心。
- 虚拟鼠标在目标拍点之前「Good 判定窗口 + 1/16 拍」就到位，保证玩家最早的有效输入也能点在目标上；跟打段要等这一下判定完（命中或 Miss）才离开，示范段在拍点后 1/16 拍离开。两个目标之间最多用半拍移过去，慢进慢出。
- 点下去时指针缩一下、被点的按钮显示按下状态，持续 1/8 拍。
- 一局开始前它停在屏幕中央偏右下；全曲结束后回到那里。
- **示范完回到屏幕中央**（2026-10-24 用户要求）：每个乐句里，示范段最后一下点完后，鼠标回到屏幕（桌面工作区）中央停着，跟打段开始前再出发去第一个目标；玩家看它一动就知道轮到自己了。回中央的时间点是示范段最后一下和跟打段第一下的正中间；两者相隔不到 0.75 拍时来不及来回，就不回中央。Mac 场景用同一套规则（`cursor-path.ts` 的 `returnToCenterStops`）。

### 桌面右键菜单与刷新

| 部件 | 原版对应 | 内容 |
| --- | --- | --- |
| 右键菜单 | 菜单窗口（`#32768`），XP 平面菜单样式 | 白底、1 像素灰边、右下有阴影；条目从上到下：「Arrange Icons By ▶」「Refresh」、分隔线、「Paste」「Paste Shortcut」（灰色不可用）、分隔线、「New ▶」、分隔线、「Properties」。鼠标所在的条目蓝底白字。菜单左上角在右键的位置 |
| 刷新 | 桌面「Refresh」 | 桌面图标消失 1/8 拍再出现，和原版刷新时图标闪一下一样 |

`desktop-refresh` 的过程（暂定）：

- 右键的位置在桌面中间的空白处，按乐句里的序号轮换几个固定位置；跟打段用和示范段同一个位置。
- 第一下：在右键位置弹出菜单。跟打段第一下 Miss 时，菜单照样在 Miss 那一刻弹出，让第二下还能接着做。
- 第二下：点「Refresh」，菜单关闭、桌面图标闪一下。第二下 Miss 时菜单直接关掉，不刷新。
- 判定字样显示在右键位置的上方。

### 本地素材缺口

以下原版素材本地没有，先用矢量图形或相近素材代替：

| 缺的素材 | 现在的做法 |
| --- | --- |
| Luna 主题位图（标题栏、按钮、开始按钮、复选框、滑块等，原在 `luna.msstyles` 里） | 全部按原版配色用渐变矢量绘制 |
| 「Control Panel」「My Recent Documents」「Set Program Access and Defaults」的图标 | 开始菜单里暂时不放这三项 |
| 标题栏字体 Trebuchet MS | 用系统里装的；没有时回落到 Tahoma。界面正文用本地素材里的 Tahoma（英文版 XP 的界面字体），后面仍留着系统中文字体兜底 |

2026-10-24 补进了旗帜（`windows-logo.png` 换成了只有旗帜的版本）、小喇叭、用户头像、网上邻居、网络连接图标和鼠标指针，原来的矢量代替已去掉。

## 已确定的动作

- 弹出窗口
- 关闭窗口
- 收邮件
- 点击刷新（右键桌面 → 刷新，动作 ID `desktop-refresh`，2026-10-24 实现）
- 托盘气泡、最小化程序窗口、开始菜单、扔进回收站（`balloon-info`、`window-minimize`、`start-menu`、`recycle-bin`，2026-10-24 用户选定并实现），设计和配套的关卡见 [windows-xp-levels.md](windows-xp-levels.md)
- 文件下载进度窗（等进度条走满再点）、音量控制（拍点上按下滑块，滑块自动拖回原位，不改实际音量）（`progress-download`、`volume-mute`，2026-10-24 用户要求），设计见 [windows-xp-levels.md](windows-xp-levels.md#等待与长按下载进度窗音量控制2026-10-24)

## 候选 / 待讨论

> 以下只是想法，尚未确定。

- 一组错误对话框层层叠出（经典的「错误窗口拖影」画面），按节奏逐个关闭
- 弹窗广告越弹越多，节奏加快
- 音量控制：按节奏点托盘小喇叭静音 / 取消静音
- 开机音效 / 关机音效作为乐句的开头与结尾

## MVP 暂定

2026-10-24 的 MVP 只做「示范段弹出消息框、跟打段关掉」这一组动作，细节见 [prototypes/mvp.md](../prototypes/mvp.md)。下表中对应的格子仍保留「待定」，试玩确认后再填。

## 每个动作需要明确的内容

| 动作 | 示范提示（声音/画面） | 玩家输入 | 成功反馈 | 失败反馈 |
| --- | --- | --- | --- | --- |
| 弹出窗口 | 待定 | 待定 | 待定 | 待定 |
| 关闭窗口 | 待定 | 待定 | 待定 | 待定 |
| 收邮件 | 待定 | 待定 | 待定 | 待定 |
| 点击刷新 | 待定 | 待定 | 待定 | 待定 |
