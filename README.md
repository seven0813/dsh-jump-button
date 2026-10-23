# dsh-jump-buttons

DSH Web 聊天的两个浮动跳转按钮：

- **↑ 回到问题开头**：把本轮最后一个用户提问滚到视口顶部（留 10px 偏移）。
- **↓ 回到结尾**：优先点击 DSH 原生「回到底部」，恢复贴底跟随；原生按钮不存在时直接滚到底。

纯客户端插件，不改 DSH 安装、不改 `@deepseek-ai` 源码，不接管或复刻 DSH 的跟随逻辑，只在用户点击时移动现有滚动容器。

仓库：<https://github.com/seven0813/dsh-jump-button>（包名仍为 `dsh-jump-buttons`，以保持已安装 profile 的链接不变）。

## 安装

```bash
git clone https://github.com/seven0813/dsh-jump-button.git
dsh plugin --profile web add link:/absolute/path/to/dsh-jump-button
```

本地目录以 `link:` 方式安装后，bundle 会进入 profile 的 `dsh.profile.bundles`；新的 bundle 通常即时生效，若页面未出现按钮，刷新一次页面即可（少数版本需要重启 `dsh web`）。

也可以从 **Plugins** 页面启用/停用。

## 卸载

```bash
dsh plugin --profile web remove dsh-jump-buttons
```

或在 Plugins 页面把 `dsh-jump-buttons` 停用/删除。

## 文件结构

```
dsh-jump-buttons/
  package.json          # dsh.bundle.patch + dsh.client（platform: web）
  cordis.patch.yml      # 插入一行宿主插件 jump-buttons
  lib/index.js          # 宿主端空插件（只负责加载客户端模块）
  lib/client.js         # 全部界面与交互逻辑
  locale/en.json        # Plugins 页展示的标题/描述
  locale/zh.json
  icon.svg              # 插件列表图标
```

## 实现要点

- **挂载点**：`shell.overlay`（全框浮动层，位于所有列之上、滚动容器之外），不与消息流或 composer 抢布局。
- **显示条件**：存在 `[data-conversation-scroll]` 且内容高度大于视口，并且没有弹窗（`[aria-modal="true"]` / `[role="dialog"]`）。新会话、Plugins 页面、无会话时自动隐藏。
- **DOM 每次点击重新查询**：不缓存滚动容器、用户消息或原生按钮节点，切换会话后仍然有效。
- **↑ 的行为**：从贴底状态点击时先即时跳出 25px 跟随窗口（避免流式输出把视图拉回底部），否则使用 `behavior: "smooth"`；平滑滚动结束后若发现被跟随逻辑拉回，再补一次即时定位。
- **↓ 的行为**：`button[aria-label="Back to bottom"]`（或「回到底部」）存在时直接 `click()`；否则 `scrollTop = scrollHeight`。滚到底会让 DSH 重新进入跟随。
- **不与原生控件重叠**：右下 `right:16px; bottom:140px`，与原生「回到底部」（位于消息列右下）和右侧轮次导航（垂直居中）错开；轮次导航特别长时按钮会自动左移 56px。
- **外观**：36px 圆形按钮，使用 `--dsw-alias-*` 主题令牌，支持 hover/active/`focus-visible`，带 `title` 与 `aria-label`，支持键盘 Tab/Enter。
- **文案**：按 `<html lang>`（回退 `navigator.language`）在中英之间切换。

## 验证结果

在 1440×900 的真实页面上用无头浏览器（Playwright 缓存的 Chromium，独立临时 profile）验证：

| 项目 | 结果 |
| --- | --- |
| 长对话滚到底后点 ↑ | `scrollTop` 落在最后一个 user 消息顶部 −10px（误差 0） |
| 点 ↓ | 回到 `scrollHeight - clientHeight`，原生「回到底部」消失（重新贴底） |
| 流式输出中点击 ↑ | 内容持续增长（`scrollHeight` 3547→3823）时视图停在 469，与问题顶部误差 0，`gap` 从 2318 增到 2530，没有被跟随逻辑拉回 |
| 弹窗 | 打开 cost 面板（`role="dialog"`）时按钮自动隐藏，Esc 关闭后恢复 |
| 与原生按钮/轮次导航重叠 | 无（本插件 1388–1424 × 680–760；原生 1194–1228 × 721–755；rail 1393–1421 × 413–435） |
| 新会话 / Plugins 页 | 按钮隐藏 |
| 720×800 窄屏 | 显示，且不遮挡发送按钮 |
| 切换中英文 | `aria-label` 立即切换 |
| 刷新页面 | 插件仍在，按钮恢复 |
| Plugins 页展示 | 标题、描述、自定义图标均正确渲染（bundle 36px / 插件行 30px） |
| 控制台错误 | 0 |

以上为本地真实页面验证结果；仓库不附带截图，以免带出本机会话与账户信息。

## 已知限制

- 依赖 DSH Web 现有的 DOM 钩子：`[data-conversation-scroll]`、`[data-chat-flow-kind="user"]`、原生按钮的 `aria-label`。未来宿主改版可能使按钮隐藏或退化为普通滚动（不会破坏页面）。
- 只跳最后一个用户提问；不支持在多个历史提问之间跳转。
- 问题条目的顶部偏移固定 10px；如果问题本身很短、且滚动目标距底部不足 32px，视图可能仍被视为贴底。
- 按钮固定在视口右侧；右侧栏展开时不会跟随消息列移动。
- `prefers-reduced-motion` 只关闭 CSS 过渡，平滑滚动仍由浏览器决定。
