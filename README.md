# dsh-jump-buttons

给 DSH Web 聊天区加三个浮动按钮：回到你正在读的那一轮的开头或结尾，或者直接回到最新输出。

npm：<https://www.npmjs.com/package/dsh-jump-buttons> · GitHub：<https://github.com/seven0813/dsh-jump-button>

## 为什么需要它

DSH Web 在模型输出时会自动贴底跟随：回答越长、轮次越多，视图越容易停在末尾。想回头细读某一轮，只能反复上滑；而 DSH 自带的「回到底部」只能往下，也不区分你正在读哪一轮。

这个插件按「轮次」导航：↑/↓ 作用于你当前正在看的那一轮（不一定是最后一轮），↓↓ 一键回到最新输出。全部由点击触发，不改变 DSH 原有的跟随行为，也不会自动跳转。

## 功能

- **↑ 回到本轮开头**：正在读的那一轮，其提问顶部对齐到视口顶部（留 10px）。
- **↓ 到本轮结尾**：本轮内容滚到视口底部；如果读的就是最后一轮，则直接到对话末尾。
- **↓↓ 回到最新**：优先点击原生「回到底部」，恢复贴底跟随，继续看流式输出。
- **自动识别当前轮**：以视口顶部为阅读线，上一轮不会被误当成当前轮；已经贴底时则视为最新一轮。
- **只作用于当前会话**：同时打开侧边对话或分屏时，按钮跟随你正在看的那个会话，不会滚动别的会话。
- **只在需要时出现**：有可滚动会话才显示；新会话、Plugins 页面、弹窗打开时自动隐藏。
- **不挡路**：固定在当前会话右侧，避开原生「回到底部」和轮次导航；窄屏不遮挡输入区。
- **流式输出中也能用**：贴底时点 ↑ 先即时跳出跟随窗口，不会被下一个 token 拽回。
- **中英双语**：跟随界面语言；带 `title` 和 `aria-label`，支持 Tab 聚焦、Enter 触发。
- **纯客户端**：无服务端、无配置项、无网络请求，外观跟随 DSH 主题。

## 安装

```bash
dsh plugin --profile web add dsh-jump-buttons
```

安装后刷新页面，对话右侧会出现三个圆形按钮。也可以在 **Plugins** 页面启用或停用。

从源码安装（用于本地开发）：

```bash
git clone https://github.com/seven0813/dsh-jump-button.git
dsh plugin --profile web add link:/absolute/path/to/dsh-jump-button
```

## 卸载

```bash
dsh plugin --profile web remove dsh-jump-buttons
```

## 兼容性

面向 DSH Web 0.2.x，Node.js >= 20。行为依赖 DSH 当前会话区的页面结构，宿主大改版后可能需要适配。

## License

MIT
