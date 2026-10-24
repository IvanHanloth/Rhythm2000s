# 场景：Windows XP 桌面

> 状态：草稿

## 视觉基调

蓝天绿草风格的壁纸、蓝色任务栏、绿色「开始」按钮、圆角蓝色标题栏窗口。（界面尽量贴近原版，可以直接使用 `assets/reference/windows-xp/` 的原版素材，见 [ADR 0004](../decisions/0004-界面贴近原版.md)。）

## 界面部件（2026-10-24 重新设计）

用户要求桌面、开始菜单、消息框、托盘、音量控制「尽可能还原 Windows 原版」。参照对象是**简体中文版 Windows XP SP2、Luna 蓝色主题**，界面文字用中文版的说法（「开始」「确定」「所有程序」「注销」「关闭计算机」）。

### 尺寸

- 部件按原版的像素尺寸绘制（标题栏、按钮、任务栏 30 像素高等），整块桌面放大 1.25 倍铺满 1280×720 的画布，相当于一台 **1024×576** 分辨率的 XP。放大倍数是暂定值，觉得字小再调。
- Follow me / Your turn 横幅和判定字样不属于 XP 界面，仍按画布坐标绘制。

### 部件清单

代码在 `src/scenes/windows-xp/components/`，可以在[XP 部件展示页](../../prototypes/xp-components/index.html)（开发面板里的「原型：XP 部件」）逐个点开看效果、听声音。

| 部件 | 原版对应 | 内容 |
| --- | --- | --- |
| 桌面 | 桌面 | Bliss 壁纸（按比例铺满，上下略裁）；左上角一列「我的文档」「我的电脑」「网上邻居」「Internet Explorer」，右下角「回收站」。图标 32 像素，白字带阴影 |
| 任务栏 | `Shell_TrayWnd` | 30 像素高的蓝色渐变条，左边绿色「开始」按钮，右边托盘 |
| 开始菜单 | 开始菜单（XP 样式） | 顶部蓝色用户栏 + 橙色分隔线；左栏白底（Internet、电子邮件，常用程序，「所有程序」）；右栏浅蓝底（我的文档、图片收藏、我的音乐、我的电脑、网上邻居、打印机和传真、帮助和支持、搜索、运行）；底部蓝条「注销」「关闭计算机」。鼠标移上去是蓝底白字 |
| 托盘 | `TrayNotifyWnd` | 浅蓝渐变区，音量图标、网络图标、时钟（24 小时制，显示本机时间） |
| 托盘气泡 | 气泡提示（`tooltips_class32` 气泡样式） | 浅黄底圆角气泡，尖角指向托盘图标，标题加粗带图标，右上角关闭按钮 |
| 音量控制 | 单击托盘音量图标弹出的小窗 | 「音量」标签、竖向滑块（两侧刻度）、「静音」复选框。松开滑块时按新音量响一声默认提示音，与原版相同 |
| 消息框 | `MessageBox`（窗口类 `#32770`） | Luna 标题栏（活动 / 非活动两种颜色）+ 关闭按钮；左侧 32 像素图标，右侧正文；底部居中按钮，默认按钮带蓝色内框。大小随文字自动调整 |

消息框有四种，对应谱面里的四个动作 ID（[chart-format.md](../chart-format.md#动作-id)）：

| 动作 ID | 原版常量 | 图标 | 按钮 |
| --- | --- | --- | --- |
| `dialog-info` | `MB_ICONINFORMATION` | `icons/dialog-info.png` | 确定 |
| `dialog-warning` | `MB_ICONWARNING` | `icons/dialog-warning.png` | 确定 |
| `dialog-error` | `MB_ICONERROR` | `icons/dialog-error.png` | 确定 |
| `dialog-question` | `MB_ICONQUESTION` | `icons/dialog-question.png` | 是(Y)、否(N) |

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

「原版事件」一列是按记忆和网上零散资料对的，没有在 XP 原机的注册表（`HKCU\AppEvents\Schemes`）里核对过。

### 本地素材缺口

以下原版素材本地没有，先用矢量图形或相近素材代替：

| 缺的素材 | 现在的做法 |
| --- | --- |
| Luna 主题位图（标题栏、按钮、开始按钮、复选框、滑块等，原在 `luna.msstyles` 里） | 全部按原版配色用渐变矢量绘制 |
| 开始按钮上的 Windows 旗帜小图标 | 矢量绘制（本地的 `windows-logo.png` 是带地球的版本，不对） |
| 托盘的小喇叭（音量）图标 | 矢量绘制 |
| 开始菜单的用户头像图片 | 用 `users.png` 代替 |
| 「控制面板」「我最近的文档」「设定程序访问和默认值」的图标 | 开始菜单里暂时不放这三项 |
| 标题栏字体 Trebuchet MS、中文界面字体宋体 | 用系统里装的；没有时回落到 Tahoma / 系统中文字体 |

## 已确定的动作

- 弹出窗口
- 关闭窗口
- 收邮件
- 点击刷新

## 候选 / 待讨论

> 以下只是想法，尚未确定。

- 托盘气泡提示「发现新硬件」，跟着节奏点掉
- 一组错误对话框层层叠出（经典的「错误窗口拖影」画面），按节奏逐个关闭
- 弹窗广告越弹越多，节奏加快
- 拖动文件到回收站
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
