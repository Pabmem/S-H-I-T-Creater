# 🎭 Mood Background

一个有趣的 VS Code 扩展 —— 通过 LLM 实时分析你的代码质量，自动切换编辑器背景图片来反映"情绪"！

## ✨ 功能特性

- 🖼️ **自适应背景图片**：自动读取 `images/` 目录中的图片，自适应分辨率显示在编辑器背景
- 🤖 **TypeSafe jev 质量评估**（主要方式）：调用 [TypeSafe](https://docs.typesafe.ai/) 的 `jev-latest` 模型对代码做结构化评估：
  - `choice` 问题 —— 从 7 个情绪标签中选一个，返回完整概率分布和置信度
  - `score` 问题 —— 按评分细则给出概率加权的质量分（可落在两级之间）
  - 对 `429 Too Many Requests` / `529 Overloaded` 自动指数退避重试
- 🧠 **Copilot LLM 兜底**：TypeSafe 不可用时降级为 GitHub Copilot 内置 LLM 分析
- 📊 **状态栏详情**：鼠标悬停状态栏可查看质量分、质量等级和各情绪的概率分布
- 🎨 **7 种情绪标签**：
  | 情绪 | 含义 | 触发场景 |
  |------|------|----------|
  | `happy` | 满意 | 代码质量不错，结构清晰 |
  | `cool` | 酷炫 | 代码出乎意料的好 |
  | `angry` | 愤怒 | 代码质量差，明显问题 |
  | `sad` | 伤心 | 代码非常糟糕 |
  | `very happy` | 非常开心 | 代码非常优秀 |
  | `angry and cool` | 又爱又恨 | 有问题但也有亮点 |
  | `wdf` | 困惑 | 完全看不懂在写什么 |
- 🔄 **平滑渐变切换**：图片切换时有 1.5 秒的淡入淡出动画
- ⚡ **实时更新**：定时分析（默认30秒）+ 文件保存时立即分析
- 🛡️ **安全渲染**：使用编辑器装饰层显示背景，不修改 VS Code 安装目录

## 📦 安装与使用

### 开发模式
```bash
npm install
npm run self-check
npm run compile
# 按 F5 启动 Extension Development Host
```

### 配置项

在 VS Code 设置中搜索 `moodBackground`：

| 设置项 | 默认值 | 说明 |
|--------|--------|------|
| `moodBackground.enabled` | `true` | 是否启用 |
| `moodBackground.opacity` | `0.15` | 背景透明度 (0.0~1.0) |
| `moodBackground.updateInterval` | `30` | 分析间隔（秒） |
| `moodBackground.linesToAnalyze` | `20` | 分析最近 N 行代码 |
| `moodBackground.apiKey` | `""` | TypeSafe (jev) API Key，留空则读环境变量 `TYPESAFE_API_KEY` |
| `moodBackground.model` | `jev-latest` | TypeSafe 评估使用的模型 |
| `moodBackground.apiEndpoint` | `""` | TypeSafe API 地址，留空使用官方默认 |
| `moodBackground.transitionDuration` | `1.5` | 渐变时长（秒） |
| `moodBackground.imagesFolder` | `""` | 自定义图片目录 |

### 命令面板

- `Mood Background: Enable` — 启用
- `Mood Background: Disable` — 禁用
- `Mood Background: Toggle` — 切换
- `Mood Background: Refresh Emotion Now` — 立即刷新

## 🖼️ 自定义图片

在 `images/` 目录中放置图片文件，文件名即为情绪标签：

```
images/
├── happy.png
├── cool.jpg
├── angry.png
├── sad.png
├── very happy.png
├── angry and cool.png
└── WDF_is_that.png
```

支持格式：`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.bmp`

## ⚠️ 注意

- 配置 TypeSafe (jev) API Key 后，代码质量判断由 `jev-latest` 模型完成，结果驱动背景图片切换
- API Key 可在 `moodBackground.apiKey` 设置中填写，或通过环境变量 `TYPESAFE_API_KEY` 提供
- 如果 TypeSafe 和 Copilot 都不可用，会自动降级为基于代码诊断的规则分析
- 插件只在可见文本编辑器中渲染背景，禁用后会立即清理装饰层

## 📁 项目结构

```
├── src/
│   ├── extension.ts          # 插件入口
│   ├── cssInjector.ts        # 安全背景装饰层
│   ├── emotionAnalyzer.ts    # 情绪分析（jev → Copilot → 诊断 兜底链）
│   ├── typeSafeClient.ts     # TypeSafe (jev) API 客户端
│   ├── imageManager.ts       # 图片管理
│   └── backgroundRenderer.ts # 渐变渲染
├── images/                   # 情绪图片资源
├── package.json              # 扩展清单
├── webpack.config.js         # 构建配置
└── tsconfig.json             # TypeScript 配置
```
