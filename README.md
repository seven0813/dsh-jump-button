# dsh-jump-buttons

给 DSH Web 聊天区加两个浮动按钮：一键回到本轮提问的开头，或回到最新输出。

npm：<https://www.npmjs.com/package/dsh-jump-buttons> · GitHub：<https://github.com/seven0813/dsh-jump-button>

## 为什么需要它

DSH Web 在模型输出时会自动贴底跟随：回答越长，视图越是一直停在最后一行。想从头读这一轮回答，只能一下一下往上滑；而 DSH 自带的「回到底部」只能往下。

这个插件补上缺少的那一半——一个显式的「回到问题开头」，同时保留「回到结尾」。两个动作都由你点击触发，不改变 DSH 原有的跟随行为，也不会自动跳转。

## 功能

- **↑ 回到问题开头**：把本轮最后一个提问滚到视口顶部（保留 10px 间距），长回答可以从头读。
- **↓ 回到结尾**：回到对话最新位置；存在原生「回到底部」时直接复用它，因此会重新进入贴底跟随。
- **只在需要时出现**：有可滚动会话才显示；新会话、Plugins 页面、弹窗打开时自动隐藏。
- **不挡路**：固定在右下，避开原生「回到底部」和右侧轮次导航；轮次导航很长时自动让位。
- **流式输出中也能用**：点 ↑ 后不会被下一个 token 拽回底部。
- **中英双语**：跟随界面语言；带 `title` 和 `aria-label`，支持 Tab 聚焦、Enter 触发。
- **纯客户端**：无服务端、无配置项、无网络请求，外观跟随 DSH 主题。

## 安装

```bash
dsh plugin --profile web add dsh-jump-buttons
```

安装后刷新页面，对话右侧会出现两个圆形按钮。也可以在 **Plugins** 页面启用或停用。

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
