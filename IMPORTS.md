# 导入格式约定（Import Conventions）

这个仓库是 **DeepSeek Harness（dsh）** 的自研扩展集合：插件（plugins）、样式（styles）与测试（tests）。
本文档描述库内内容的组织方式和关键识别标记，让**任何人、任何 AI 会话**都能读懂并把它导入自己的 dsh 环境。

> 原则：**约定优先，但不设死规矩。** 下面的内容都是"推荐这样组织"，不是"必须这样"。
> 导入器只需要认准几个关键标记（见 [识别标记](#识别标记)），其余结构可自由扩展。

---

## 仓库布局（推荐，非强制）

```
deepseek-extensions/
├── README.md            # 仓库说明
├── IMPORTS.md           # 本文档
├── plugins/             # 插件包：一个子目录 = 一个包
│   └── dsh-stylus/      #   样式插件（内置样式预设，见 PRESETS）
├── styles/              # （可选）独立主题文件：一个文件 = 一个主题
├── tests/               # 测试脚本（纯 Node，无依赖）
│   └── test-parser.cjs
└── docs/                # （可选）更多文档
```

> 样式既可以**内置在插件预设**里（`plugins/dsh-stylus/lib/client.js` 的 `PRESETS` 数组，
> 新建样式时下拉选择），也可以**单独放 `styles/`**（一个文件一个主题，粘贴进"新建样式"即可）。
> 两者都支持，按喜好选择。

允许出现任何额外目录（`extras/`、`scripts/`、`assets/`……），导入时忽略不认识的内容即可。

---

## 插件包格式（plugins/ 下每个子目录）

一个插件包就是一个 npm 风格的包，**目录名 = 包名**。

### 元数据（package.json）

最少需要这些字段：

```jsonc
{
  "name": "dsh-stylus",                    // 包名，必须与目录名一致
  "version": "1.0.0",
  "type": "module",
  "main": "lib/index.js",                  // host 半入口（可以是很小的空插件）
  "exports": {
    ".": "./lib/index.js",                 // host 半
    "./client": "./lib/client.js"          // 浏览器半（必须）
  },
  "dsh": {
    "client": {
      "platform": "web",                   // 声明这是一个 web 客户端插件
      "inject": ["slots"]                  // （可选）依赖的客户端服务
    }
  }
}
```

- `dsh.client` 字段是 **dsh 识别"这是一个客户端插件包"的关键标记**（platform 必须是 `"web"`）。
- `exports["./client"]` 指向浏览器端 bundle。

### 浏览器端 bundle（lib/client.js）

固定外壳 + 自定义内容：

```js
window.__ModuleLoader__.load({
  id: "dsh-stylus",            // 必须等于包名
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    var React = require("react");   // React 由宿主提供，直接 require

    // ...你的代码...

    var inject = ["slots"];         // 依赖的客户端服务（可选）
    function apply(ctx) { /* 插件逻辑：注册 UI、注入样式等 */ }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
```

- 外壳（`__ModuleLoader__.load` / factory / exports 三件套）是**固定格式**，其余都是自由代码。
- 浏览器端可 `require` 的模块：`react`、`react/jsx-runtime`，以及 `dsh.client` 名册里的其他包。

### host 半（lib/index.js）

可以是最小的空插件（加载器需要一个可解析入口）：

```js
export const name = "dsh-stylus";
export const inject = [];
export function apply(ctx) {}
```

### 安装到任意 dsh 实例

```bash
# 1. 把整个包复制到 profile 的模块目录
cp -r plugins/dsh-stylus "$DSH_HOME/profiles/node_modules/dsh-stylus"

# 2. 在 profile 的 cordis.patch.yml 里注册一行：
#    - insert:
#        - id: stylus
#          name: dsh-stylus

# 3. 重启 dsh（web: 重启应用后刷新页面）
```

---

## 样式格式（styles/ 下每个文件）

一个文件就是一个完整主题。**纯 CSS 就完全可用**；带配置头可以生成"配置面板"。

### 配置头（可选，推荐）

文件头部放一个 `==UserStyle==` 注释块（与 Stylus 生态兼容的语法子集）：

```css
/* ==UserStyle==
@advanced dropdown bg "背景图" {
  builtin "内置图" <<<EOT url("https://example.com/bg.jpg") EOT;
  custom "本地图" <<<EOT url("/*[[bg-custom]]*\/") EOT;
}
@advanced text bg-custom "自定义背景图" ""
@advanced color theme-color "主题色" #00853e
@advanced checkbox fancy "花哨模式" true
@advanced textarea notes "备注" ""
==/UserStyle== */
```

然后在 CSS 正文里用占位符引用：`/*[[bg]]*/`、`/*[[theme-color]]*/`……

支持的 `@advanced` 类型：

| 类型 | 作用 | 默认值写法 |
|---|---|---|
| `dropdown` | 下拉框（选项用 `key "标签" <<<EOT 值 EOT;`） | 第一项 |
| `text` | 单行文本（可配图片上传） | `"默认"` |
| `textarea` | 多行文本 | `"默认"` |
| `color` | 取色器 | `#rrggbb` |
| `checkbox` | 开关 | `true` / `false` |

细节：
- 占位符 `/*[[名字]]*/` 会被替换成配置值；**值里可以嵌套其他占位符**（如 dropdown 的值引用 text 字段）。
- `*\/` 是块注释内的 `*/` 转义写法，导入时应还原为 `*/`。
- 没有配置头的纯 CSS 文件：直接粘贴进"新建样式"即可。

---

## 测试

`tests/` 下是零依赖的 Node 脚本，`node tests/test-parser.cjs` 直接跑。

---

## 识别标记（给导入器/AI 的快速判断表）

| 内容 | 看哪里 | 判定 |
|---|---|---|
| 插件包 | 目录含 `package.json`，且 `dsh.client.platform === "web"` | → 按插件安装 |
| 客户端 bundle | 文件含 `window.__ModuleLoader__.load(` | → 浏览器端代码 |
| 样式主题 | 文件含 `==UserStyle==` 头，或就是一段 CSS | → 按样式导入 |
| 其他 | 不匹配以上任何标记 | → 跳过/人工判断 |

---

## 自由扩展（不做限制的部分）

- 新增目录、新增字段、新增 `@advanced` 类型（只要导入器能识别关键标记）
- 包内代码风格：JS/JSX/TS 产物随意，只要导出格式对
- 样式可以是 SCSS 编译产物、带变量、带注释，随意

**底线只有一条：仓库内不出现个人数据**（token、密钥、本地绝对路径、账号信息）。这是这个库的硬规则。
