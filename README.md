# DeepSeek Harness Extensions

我自己用的 DeepSeek Harness 扩展：插件和样式，放这里备份 + 跨设备同步用的。

## 内容

- `plugins/dsh-stylus/` — 自定义样式插件（Stylus 风格：注入 CSS、多主题切换、配置面板）
- `styles/` — 样式主题（比如 blacked 那套绿黑红）
- `tests/` — 零依赖小测试（`node tests/test-parser.cjs`）

## 自用说明

这是**自用**仓库，按我自己的习惯整理，没打算做成标准产品。你碰巧看到的话，喜欢就随便拿去用，文档不一定全，见谅。

## 给自己备忘的快速开始

1. 插件装法：把 `plugins/dsh-stylus` 复制到 `$DSH_HOME/profiles/node_modules/dsh-stylus`，
   然后在 `$DSH_HOME/profiles/web/cordis.patch.yml` 加一行注册：

   ```yaml
   - insert:
       - id: stylus
         name: dsh-stylus
   ```

2. 重启 DeepSeek Harness → **设置 → 样式** 就能用了。
3. 样式：把 `styles/` 下文件内容粘进"新建样式"即可；带 `==UserStyle==` 配置头的会自动生成配置面板。

## 导入格式

别的会话 / 别的 AI 想导入这个库，看 `IMPORTS.md`（约定的导入方式，不强制）。

## 许可

MIT
