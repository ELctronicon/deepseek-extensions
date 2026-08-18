# dsh-stylus

Stylus 风格的自定义样式插件，运行在 DeepSeek Harness Web 界面（设置 → 样式）。

## 功能

- **注入自定义 CSS**：实时修改界面外观，改动即时生效并自动保存（浏览器 localStorage）。
- **多主题切换**：多套样式一键切换，每个样式独立保存自己的 CSS 与配置。
- **内置样式预设**：插件自带样式模板（`X blacked` 绿黑红主题等），新建样式时可先选预设。
- **`==UserStyle==` 配置面板**：样式头部声明 `@advanced` 配置项（下拉 / 文本 / 多行文本 / 取色 / 开关），
  编辑框上方自动生成配置表单；CSS 里用 `/*[[名字]]*/` 占位符引用配置值，支持嵌套引用。
- **图片内嵌**：配置面板的文本字段带"选图"按钮，本地图片自动转 base64 内嵌进样式（png/jpg/svg 均可）。
- **备份 / 恢复**：一键导出全部样式为 JSON 文件，可随时从备份恢复。
- **无原生弹窗**：重命名（行内编辑）、删除（两段确认）全部使用页面内联 UI。

## 安装

见仓库根 README.md 的"快速开始"。

## 文件说明

| 文件 | 作用 |
|---|---|
| `package.json` | 包元数据，`dsh.client` 声明（web 客户端插件） |
| `lib/index.js` | host 半（空插件，供加载器挂载） |
| `lib/client.js` | 浏览器半：`__ModuleLoader__.load` bundle，含全部逻辑、UI 与内置样式预设 |

## 内置预设

`lib/client.js` 里 `PRESETS` 数组即内置样式（目前：`X blacked`、`空白模板`），
新建样式时下拉选择。想加新预设：把样式文本作为模板字符串加进 `PRESETS` 即可。

## 配置头语法速览（Stylus 兼容子集）

```css
/* ==UserStyle==
@advanced dropdown bg "背景图" {
  builtin "内置图" <<<EOT url("https://example.com/bg.jpg") EOT;
  custom "本地图" <<<EOT url("/*[[bg-custom]]*\/") EOT;
}
@advanced text bg-custom "自定义背景图" ""
@advanced color theme-color "主题色" #00853e
==/UserStyle== */
:root { --bg: /*[[bg]]*/; --theme: /*[[theme-color]]*/; }
```

详细约定见仓库 [docs/IMPORTS.md](../docs/IMPORTS.md)。

## 许可

MIT
