# DeepSeek Harness Extensions

> 为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 制作的自研插件与样式集合。
> Self-made plugins & styles for DeepSeek Harness.

**公开仓库 · 零个人数据。** 本仓库可被任何人查看和使用，但内容保证不含任何个人数据
（无 token、无密钥、无本地路径、无账号信息）。贡献者请遵守同一底线，见 [IMPORTS.md](IMPORTS.md)。

---

## 目录

| 路径 | 内容 |
|---|---|
| `plugins/dsh-stylus/` | Stylus 风格自定义样式插件：注入 CSS、多主题切换、`==UserStyle==` 配置面板、备份/恢复 |
| `styles/harness-blacked.css` | X / Twitter "blacked" 移植主题（绿→黑→红渐变风） |
| `tests/` | 零依赖 Node 单测（`node tests/test-parser.cjs`） |
| `IMPORTS.md` | 导入格式约定（新会话 / 新 AI 导入本库前请先读） |

## 快速开始

### 安装 dsh-stylus 插件

1. 将 `plugins/dsh-stylus` 整个目录复制到 `$DSH_HOME/profiles/node_modules/dsh-stylus`
   （Windows 默认 `$DSH_HOME` 为 `C:\Users\<你>\\.dsh`）
2. 编辑 `$DSH_HOME/profiles/web/cordis.patch.yml`，追加：

   ```yaml
   - insert:
       - id: stylus
         name: dsh-stylus
   ```

3. 重启 DeepSeek Harness → 打开 **设置 → 样式** 即可使用。

### 使用样式主题

- 打开 **设置 → 样式 → + 新建样式**，把 `styles/` 下任意文件内容粘贴进编辑框（带配置头的样式会自动生成配置面板）。
- 支持多套样式切换、`@advanced` 配置项（下拉/文本/取色/开关/图片上传）、导出备份与恢复。

### 跑测试

```bash
node tests/test-parser.cjs
```

## 许可

MIT License，详见 [LICENSE](LICENSE)。
