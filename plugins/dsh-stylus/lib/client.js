window.__ModuleLoader__.load({
	id: "dsh-stylus",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

		var React = require("react");

		// ══════════════════════════════════════════════════════════════════
		//  storage (browser-local)
		// ══════════════════════════════════════════════════════════════════
		var STORE_KEY = "dsh-stylus:v1";

		function loadStore() {
			try {
				var raw = localStorage.getItem(STORE_KEY);
				if (raw) {
					var data = JSON.parse(raw);
					if (data && Array.isArray(data.themes)) {
						if (data.configs === undefined) data.configs = {};
						return data;
					}
				}
			} catch (err) { /* corrupted store: fall through to defaults */ }
			return { themes: [], activeId: null, enabled: true, configs: {} };
		}

		function saveStore(store) {
			try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (err) { /* storage unavailable */ }
		}

		function uid() {
			return "t" + Math.random().toString(36).slice(2, 10);
		}

		function activeTheme(store) {
			for (var i = 0; i < store.themes.length; i++) {
				if (store.themes[i].id === store.activeId) return store.themes[i];
			}
			return null;
		}

		// ══════════════════════════════════════════════════════════════════
		//  Stylus-style ==UserStyle== config parsing
		// ══════════════════════════════════════════════════════════════════
		function unquote(v) {
			v = (v || "").trim();
			if (v.length >= 2 && v[0] === '"' && v[v.length - 1] === '"') return v.slice(1, -1);
			return v;
		}

		function parseUserStyle(css) {
			var m = /\/\*\s*==UserStyle==([\s\S]*?)==\/UserStyle==\s*\*\//.exec(css || "");
			if (!m) return null;
			var body = m[1];
			var decls = [];
			// dropdown blocks: @advanced dropdown name "Label" { key "Label" <<<EOT value EOT; ... }
			var dropRe = /@advanced\s+dropdown\s+([\w-]+)\s+"([^"]*)"\s*\{([\s\S]*?)\n\s*\}/g;
			var dropMatch;
			while ((dropMatch = dropRe.exec(body)) !== null) {
				var options = [];
				var optRe = /([\w-]+)\s+"([^"]*)"\s+<<<EOT([\s\S]*?)EOT;/g;
				var optMatch;
				while ((optMatch = optRe.exec(dropMatch[3])) !== null) {
					options.push({
						key: optMatch[1],
						label: optMatch[2],
						value: optMatch[3].trim().replace(/\\\//g, "/")
					});
				}
				if (options.length === 0) continue;
				decls.push({ type: "dropdown", name: dropMatch[1], label: dropMatch[2], options: options, pos: dropMatch.index });
			}
			// single-line declarations
			var simpleRe = /@advanced\s+(text|textarea|color|checkbox)\s+([\w-]+)\s+"([^"]*)"\s*(.*)$/gm;
			var simpleMatch;
			while ((simpleMatch = simpleRe.exec(body)) !== null) {
				decls.push({
					type: simpleMatch[1],
					name: simpleMatch[2],
					label: simpleMatch[3],
					defaultValue: unquote(simpleMatch[4]),
					pos: simpleMatch.index
				});
			}
			decls.sort(function (a, b) { return a.pos - b.pos; });
			return decls.length ? decls : null;
		}

		function defaultConfig(decls) {
			var cfg = {};
			for (var i = 0; i < decls.length; i++) {
				var d = decls[i];
				if (d.type === "dropdown") cfg[d.name] = d.options[0].key;
				else cfg[d.name] = d.defaultValue === "" || d.defaultValue === undefined ? "" : d.defaultValue;
			}
			return cfg;
		}

		// Replace every /*[[name]]*/ placeholder with the config value,
		// iterating so a value may itself contain placeholders (Stylus-style).
		function renderCss(css, config) {
			config = config || {};
			var out = css || "";
			for (var pass = 0; pass < 12; pass++) {
				var changed = false;
				out = out.replace(/\/\*\[\[([\w-]+)\]\]\*\//g, function (all, name) {
					var v = config[name];
					if (v === undefined || v === null) return all;
					changed = true;
					return String(v);
				});
				if (!changed) break;
			}
			return out;
		}

		// Map a stored config (dropdown fields hold the option KEY) to the
		// values that should replace placeholders (dropdown fields become the
		// option's CSS value).
		function buildRenderConfig(decls, config) {
			var out = {};
			for (var i = 0; i < decls.length; i++) {
				var d = decls[i];
				var v = config ? config[d.name] : undefined;
				if (d.type === "dropdown") {
					var chosen = null;
					for (var j = 0; j < d.options.length; j++) {
						if (d.options[j].key === v) { chosen = d.options[j]; break; }
					}
					if (!chosen) chosen = d.options[0];
					out[d.name] = chosen.value;
				} else {
					out[d.name] = v === undefined ? "" : v;
				}
			}
			return out;
		}

		function rgbToHex(rgb) {
			var m = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(rgb);
			if (!m) return null;
			var h = "#";
			for (var i = 1; i <= 3; i++) {
				var c = parseInt(m[i], 10);
				if (c < 0) c = 0;
				if (c > 255) c = 255;
				h += ("0" + c.toString(16)).slice(-2);
			}
			return h;
		}

		function colorInputValue(v, fallback) {
			if (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v)) return v;
			var hex = typeof v === "string" ? rgbToHex(v) : null;
			return hex || fallback;
		}

		// ══════════════════════════════════════════════════════════════════
		//  CSS injection
		// ══════════════════════════════════════════════════════════════════
		var STYLE_ID = "dsh-stylus-css";

		function syncCss(store) {
			var css = "";
			if (store.enabled) {
				var theme = activeTheme(store);
				if (theme) {
					var decls = parseUserStyle(theme.css);
					var cfg = decls ? buildRenderConfig(decls, (store.configs || {})[theme.id]) : {};
					css = renderCss(theme.css, cfg);
				}
			}
			var el = document.getElementById(STYLE_ID);
			if (!css) {
				if (el) el.remove();
				return;
			}
			if (!el) {
				el = document.createElement("style");
				el.id = STYLE_ID;
				el.dataset.plugin = "dsh-stylus";
				el.dataset.pluginCss = STYLE_ID;
				document.head.appendChild(el);
			}
			if (el.textContent !== css) el.textContent = css;
		}

		// ══════════════════════════════════════════════════════════════════
		//  tiny UI helpers
		// ══════════════════════════════════════════════════════════════════
		var BTN = {
			padding: "4px 12px",
			borderRadius: "6px",
			border: "1px solid var(--dsw-alias-border-l2, #3a3a40)",
			background: "var(--dsw-alias-bg-module-platform, #26262b)",
			color: "var(--dsw-alias-label-primary, #e8e8ea)",
			cursor: "pointer",
			fontSize: "12px",
			lineHeight: "20px"
		};

		function button(label, onClick, extra) {
			extra = extra || {};
			var style = extra.style || {};
			for (var k in extra) {
				if (k !== "style" && k !== "disabled") style[k] = extra[k];
			}
			var props = { type: "button", onClick: onClick, style: Object.assign({}, BTN, style) };
			if (extra.disabled) props.disabled = true;
			return React.createElement("button", props, label);
		}

		var FIELD_STYLE = {
			padding: "4px 8px",
			borderRadius: "6px",
			border: "1px solid var(--dsw-alias-border-l2, #3a3a40)",
			background: "#16181c",
			color: "#e8e8ea",
			fontSize: "12px",
			fontFamily: "inherit"
		};

		// ══════════════════════════════════════════════════════════════════
		//  config field renderer
		// ══════════════════════════════════════════════════════════════════
		function ConfigField(props) {
			var decl = props.decl;
			var value = props.value;
			var onChange = props.onChange;
			var onPickImage = props.onPickImage;

			if (decl.type === "dropdown") {
				return React.createElement("select", {
					value: value,
					onChange: function (e) { onChange(e.target.value); },
					style: Object.assign({}, FIELD_STYLE, { minWidth: "180px" })
				}, decl.options.map(function (o) {
					return React.createElement("option", { key: o.key, value: o.key }, o.label);
				}));
			}
			if (decl.type === "color") {
				return React.createElement("input", {
					type: "color",
					value: colorInputValue(value, "#00853e"),
					onChange: function (e) { onChange(e.target.value); },
					style: { width: "36px", height: "26px", padding: "0", border: "1px solid var(--dsw-alias-border-l2, #3a3a40)", borderRadius: "6px", background: "#16181c", cursor: "pointer" }
				});
			}
			if (decl.type === "checkbox") {
				return React.createElement("input", {
					type: "checkbox",
					checked: value === "true",
					onChange: function (e) { onChange(e.target.checked ? "true" : "false"); },
					style: { cursor: "pointer" }
				});
			}
			if (decl.type === "textarea") {
				return React.createElement("textarea", {
					value: value,
					onChange: function (e) { onChange(e.target.value); },
					rows: 3,
					spellCheck: false,
					style: Object.assign({}, FIELD_STYLE, { width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "ui-monospace, Consolas, monospace" })
				});
			}
			// text: single line + optional image picker
			return React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "6px", flex: 1, minWidth: 0 } },
				React.createElement("input", {
					type: "text",
					value: value,
					onChange: function (e) { onChange(e.target.value); },
					spellCheck: false,
					placeholder: "URL 或点选图",
					style: Object.assign({}, FIELD_STYLE, { flex: 1, minWidth: 0 })
				}),
				button("选图", function () { onPickImage(decl.name); }, { padding: "4px 8px", fontSize: "11px" })
			);
		}

		// ══════════════════════════════════════════════════════════════════
		//  built-in templates
		// ══════════════════════════════════════════════════════════════════
		var BLANK_TEMPLATE = `/* 在这里写 CSS，例如： */
.main { color: hotpink; }`;

		var BLACKED_TEMPLATE = `/* ==UserStyle==
@name           X blacked
@advanced dropdown bg "背景图" {
  builtin "内置图（需联网）" <<<EOT url("https://pbs.twimg.com/media/GvqSQdhWAAAdli8?format=jpg&name=4096x4096") EOT;
  custom "本地图片（选下方 bg-custom）" <<<EOT url("/*[[bg-custom]]*/") EOT;
}
@advanced text bg-custom "自定义背景图（URL 或点选图）" ""
@advanced color theme-color "主题色" #00853e
@advanced text font-color "正常文字色" rgba(255,0,0,0.7)
==/UserStyle== */
/* X / Twitter "blacked" — 按原样式颜色逻辑还原 */
:root {
  --dshx-bg-image: /*[[bg]]*/;
  --dshx-green: /*[[theme-color]]*/;
  --dshx-green-bright: #00b354;
  --dshx-green-dark: #005a2d;
  --dshx-red: #e31c23;
  --dshx-red-dark: #5a0a0a;
  --dshx-font: /*[[font-color]]*/;
  --dshx-muted: #b8b8b8;
  /* 主按钮渐变（调淡，0.55） */
  --dshx-gradient: linear-gradient(90deg,
    rgba(0, 133, 62, 0.55) 0%,
    rgba(0, 133, 62, 0.55) 24%,
    rgba(0, 90, 45, 0.55) 32%,
    rgba(0, 0, 0, 0.55) 40%,
    rgba(0, 0, 0, 0.55) 60%,
    rgba(90, 10, 10, 0.55) 68%,
    rgba(227, 28, 35, 0.55) 76%,
    rgba(227, 28, 35, 0.55) 100%);
  /* 淡色按钮渐变（0.35） */
  --dshx-gradient-soft: linear-gradient(90deg,
    rgba(0, 133, 62, 0.35) 0%,
    rgba(0, 133, 62, 0.35) 24%,
    rgba(0, 90, 45, 0.35) 32%,
    rgba(0, 0, 0, 0.35) 40%,
    rgba(0, 0, 0, 0.35) 60%,
    rgba(90, 10, 10, 0.35) 68%,
    rgba(227, 28, 35, 0.35) 76%,
    rgba(227, 28, 35, 0.35) 100%);

  /* 文字映射：正常=红(font-color)，次要/说明/灰色=灰 */
  --dsw-alias-label-primary: var(--dshx-font);
  --dsw-alias-label-secondary: var(--dshx-muted);
  --dsw-alias-label-tertiary: var(--dshx-muted);
  --dsw-alias-label-caption: var(--dshx-muted);
  --dsw-static-neutral-bluish-400: var(--dshx-green-bright);
  --dsw-alias-interactive-bg-hover: rgba(0, 133, 62, 0.18);
}
/* 背景图（可选）：浅色透出，不强制黑底 */
body::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  background: var(--dshx-bg-image) center / cover fixed;
  filter: blur(2px);
  opacity: 0.6;
  pointer-events: none;
}
/* 正常文字 → 红（兜底） */
body { color: var(--dshx-font) !important; }
/* 变色的文字（链接等）→ 绿 */
a { color: var(--dshx-green) !important; }
a:hover { color: var(--dshx-green-bright) !important; }
::selection { background: var(--dshx-green) !important; color: #fff !important; }
/* 所有 svg / 标志 → 绿（按钮内的除外，见下） */
svg, svg * {
  color: var(--dshx-green) !important;
  fill: currentColor !important;
  stroke: currentColor !important;
}
/* 滚动条 → 绿黑红渐变 */
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-thumb { background: var(--dshx-gradient); border-radius: 6px; }
::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.15); }
::-webkit-scrollbar-corner { background: transparent; }

/* ── 按钮：只给"实色填充"的按钮上渐变 ──
   通过 harness 按钮变量覆盖（类名 hash 变化也不怕）。
   透明/图标/描边按钮（background:0 0）保持原样。 */
:root {
  --dsw-alias-button-info-fill: var(--dshx-gradient);
  --dsw-alias-button-info-hover: var(--dshx-gradient);
  --dsw-alias-button-primary-fill: var(--dshx-gradient);
  --dsw-alias-label-primary-foreground: #ffffff;
  --dsw-alias-button-ghost-active-fill: var(--dshx-gradient-soft);
  --dsw-alias-interactive-bg-primary: var(--dshx-gradient-soft);
}
/* 实色/淡色按钮清单（有渐变背景的按钮）：
   前景（文字 + 图标）统一白色 */
button:is([class$="_primary"], [class$="_primaryButton"], [class$="_add"],
          [class$="_message"], [class$="_noteSave"], [class$="_save"],
          [class$="_rowStatus"], [class$="_inUse"]) {
  color: #fff !important;
}
button:is([class$="_primary"], [class$="_primaryButton"], [class$="_add"],
          [class$="_message"], [class$="_noteSave"], [class$="_save"],
          [class$="_rowStatus"], [class$="_inUse"]) svg,
button:is([class$="_primary"], [class$="_primaryButton"], [class$="_add"],
          [class$="_message"], [class$="_noteSave"], [class$="_save"],
          [class$="_rowStatus"], [class$="_inUse"]) svg * {
  color: #fff !important;
  fill: currentColor !important;
  stroke: currentColor !important;
}
/* 透明图标按钮内的图标保持绿色 */
button[class$="_iconButton"] svg,
button[class$="_iconButton"] svg * {
  color: var(--dshx-green) !important;
  fill: currentColor !important;
  stroke: currentColor !important;
}

/* 输入框：保持 harness 默认，聚焦时绿色提示 */
textarea:focus,
input:focus,
[contenteditable="true"]:focus {
  border-color: var(--dshx-green) !important;
  box-shadow: 0 0 0 2px rgba(0, 133, 62, 0.35) !important;
  outline: none !important;
  caret-color: var(--dshx-green-bright) !important;
}`;

		// ══════════════════════════════════════════════════════════════════
		//  the settings section component
		// ══════════════════════════════════════════════════════════════════
		function StylusPanel() {
			var state = React.useState(loadStore);
			var store = state[0];
			var setStore = state[1];
			var editing = React.useState(null);       // theme id being renamed
			var editingId = editing[0];
			var setEditingId = editing[1];
			var nameState = React.useState("");
			var editingName = nameState[0];
			var setEditingName = nameState[1];
			var pendingDel = React.useState(null);    // theme id awaiting delete confirm
			var pendingDeleteId = pendingDel[0];
			var setPendingDeleteId = pendingDel[1];
			var restoreDraft = React.useState(null);  // parsed backup awaiting confirm
			var draft = restoreDraft[0];
			var setDraft = restoreDraft[1];

			var imgInputRef = React.useRef(null);
			var restoreInputRef = React.useRef(null);
			var imgTargetField = React.useRef(null);

			React.useEffect(function () {
				saveStore(store);
				syncCss(store);
			}, [store]);

			function update(patch) {
				setStore(Object.assign({}, store, patch));
			}

			function setEnabled(enabled) { update({ enabled: enabled }); }

			function activate(id) {
				setEditingId(null);
				setPendingDeleteId(null);
				update({ activeId: id });
			}

			function addTheme() {
				var n = store.themes.length + 1;
				var theme = { id: uid(), name: "样式 " + n, css: n === 1 ? BLACKED_TEMPLATE : BLANK_TEMPLATE };
				var next = { themes: store.themes.concat([theme]), activeId: theme.id };
				var decls = parseUserStyle(theme.css);
				if (decls) next.configs = Object.assign({}, store.configs, { [theme.id]: defaultConfig(decls) });
				setStore(next);
			}

			function commitRename() {
				var name = editingName.trim();
				if (editingId && name) {
					setStore(function (prev) {
						return Object.assign({}, prev, {
							themes: prev.themes.map(function (t) { return t.id === editingId ? Object.assign({}, t, { name: name }) : t; })
						});
					});
				}
				setEditingId(null);
			}

			function startRename(id) {
				for (var i = 0; i < store.themes.length; i++) {
					if (store.themes[i].id === id) {
						setEditingName(store.themes[i].name);
						break;
					}
				}
				setEditingId(id);
			}

			function removeTheme(id) {
				setStore(function (prev) {
					var themes = prev.themes.filter(function (t) { return t.id !== id; });
					var activeId = prev.activeId === id ? (themes.length ? themes[0].id : null) : prev.activeId;
					var configs = Object.assign({}, prev.configs);
					delete configs[id];
					return { themes: themes, activeId: activeId, enabled: prev.enabled, configs: configs };
				});
				setPendingDeleteId(null);
			}

			function setCss(css) {
				var id = store.activeId;
				if (!id) return;
				setStore(function (prev) {
					return Object.assign({}, prev, {
						themes: prev.themes.map(function (t) { return t.id === id ? Object.assign({}, t, { css: css }) : t; })
					});
				});
			}

			function updateConfig(name, value) {
				var id = store.activeId;
				if (!id) return;
				setStore(function (prev) {
					var per = Object.assign({}, (prev.configs || {})[id] || {}, { [name]: value });
					return Object.assign({}, prev, {
						configs: Object.assign({}, prev.configs || {}, { [id]: per })
					});
				});
			}

			function pickImage(fieldName) {
				imgTargetField.current = fieldName;
				if (imgInputRef.current) imgInputRef.current.click();
			}

			function onImgFile(e) {
				var file = e.target.files && e.target.files[0];
				var field = imgTargetField.current;
				if (!file || !field) return;
				var reader = new FileReader();
				reader.onload = function () {
					var id = store.activeId;
					if (!id) return;
					var dataUrl = reader.result;
					setStore(function (prev) {
						var per = Object.assign({}, (prev.configs || {})[id] || {}, { [field]: dataUrl });
						return Object.assign({}, prev, {
							configs: Object.assign({}, prev.configs || {}, { [id]: per })
						});
					});
				};
				reader.readAsDataURL(file);
				e.target.value = "";
			}

			function exportBackup() {
				var blob = new Blob([JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), store: store }, null, 2)], { type: "application/json" });
				var url = URL.createObjectURL(blob);
				var a = document.createElement("a");
				var d = new Date();
				var pad = function (n) { return (n < 10 ? "0" : "") + n; };
				a.href = url;
				a.download = "dsh-stylus-backup-" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + ".json";
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
			}

			function onRestoreFile(e) {
				var file = e.target.files && e.target.files[0];
				if (!file) return;
				var reader = new FileReader();
				reader.onload = function () {
					try {
						var data = JSON.parse(reader.result);
						if (!data || !data.store || !Array.isArray(data.store.themes)) throw new Error("bad backup");
						if (data.store.configs === undefined) data.store.configs = {};
						setDraft(data.store);
					} catch (err) {
						window.alert("备份文件无效，无法恢复。");
					}
				};
				reader.readAsText(file);
				e.target.value = "";
			}

			function commitRestore() {
				if (draft) {
					setStore(draft);
					saveStore(draft);
					syncCss(draft);
				}
				setDraft(null);
			}

			var active = activeTheme(store);
			var decls = active ? parseUserStyle(active.css) : null;
			var activeConfig = active ? Object.assign({}, defaultConfig(decls || []), (store.configs || {})[active.id] || {}) : null;

			return React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } },
				React.createElement("div", { style: { fontSize: "14px", fontWeight: 600, color: "var(--dsw-alias-label-primary, inherit)" } }, "自定义样式 (Stylus)"),
				React.createElement("div", { style: { fontSize: "12px", color: "var(--dsw-alias-label-tertiary, #999)", lineHeight: "18px" } },
					"注入自定义 CSS 改变界面外观。样式支持 Stylus 的 ==UserStyle== 配置头：声明 @advanced 配置项后会自动生成配置面板。样式保存在浏览器本地，可用下方按钮备份。"),

				// enable switch
				React.createElement("label", { style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" } },
					React.createElement("input", { type: "checkbox", checked: store.enabled, onChange: function (e) { setEnabled(e.target.checked); } }),
					"启用自定义样式"),

				// theme list
				React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "4px" } },
					store.themes.length === 0
						? React.createElement("div", { style: { fontSize: "12px", color: "var(--dsw-alias-label-tertiary, #999)", padding: "4px 0" } }, "还没有样式，点击下方\u201C+ 新建样式\u201D开始。")
						: store.themes.map(function (theme) {
							var selected = theme.id === store.activeId;
							if (editingId === theme.id) {
								return React.createElement("div", {
									key: theme.id,
									style: { display: "flex", alignItems: "center", gap: "6px", padding: "4px 8px", borderRadius: "8px", background: "var(--dsw-alias-bg-module-platform, rgba(127,127,255,0.08))" }
								},
									React.createElement("input", {
										type: "text",
										value: editingName,
										onChange: function (e) { setEditingName(e.target.value); },
										onKeyDown: function (e) {
											if (e.key === "Enter") commitRename();
											if (e.key === "Escape") setEditingId(null);
										},
										autoFocus: true,
										style: Object.assign({}, FIELD_STYLE, { flex: 1 })
									}),
									button("确定", commitRename, { padding: "2px 10px", fontSize: "11px" }),
									button("取消", function () { setEditingId(null); }, { padding: "2px 10px", fontSize: "11px" })
								);
							}
							var confirming = pendingDeleteId === theme.id;
							return React.createElement("div", {
								key: theme.id,
								style: {
									display: "flex", alignItems: "center", gap: "8px",
									padding: "6px 8px", borderRadius: "8px", cursor: "pointer",
									background: selected ? "var(--dsw-alias-bg-module-platform, rgba(127,127,255,0.12))" : "transparent",
									border: "1px solid " + (selected ? "var(--dsw-static-neutral-bluish-400, #6f6fff)" : "var(--dsw-alias-border-l2, #333)")
								},
								onClick: function () { activate(theme.id); }
							},
								React.createElement("input", { type: "radio", checked: selected, readOnly: true, onClick: function (e) { e.stopPropagation(); activate(theme.id); } }),
								React.createElement("span", { style: { flex: 1, fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, theme.name),
								button("重命名", function (e) { e.stopPropagation(); startRename(theme.id); }, { padding: "2px 8px", fontSize: "11px" }),
								confirming
									? button("确认删除？", function (e) { e.stopPropagation(); removeTheme(theme.id); }, { padding: "2px 8px", fontSize: "11px", color: "#f87171", fontWeight: 600 })
									: button("删除", function (e) { e.stopPropagation(); setPendingDeleteId(theme.id); }, { padding: "2px 8px", fontSize: "11px", color: "#f87171" })
							);
						})
				),

				// actions: new + backup/restore
				React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
					button("+ 新建样式", addTheme),
					button("备份样式（导出文件）", exportBackup),
					button("从备份恢复", function () { if (restoreInputRef.current) restoreInputRef.current.click(); }),
					React.createElement("input", {
						type: "file",
						accept: ".json,application/json",
						ref: restoreInputRef,
						onChange: onRestoreFile,
						style: { display: "none" }
					})
				),

				// restore confirmation bar (inline, no native dialogs)
				draft
					? React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", borderRadius: "8px", background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.5)", fontSize: "12px" } },
						React.createElement("span", { style: { flex: 1, color: "#fbbf24" } }, "将替换当前全部样式，确定恢复？"),
						button("确认恢复", commitRestore, { color: "#fbbf24", fontWeight: 600 }),
						button("取消", function () { setDraft(null); }, {})
					)
					: null,

				// config panel (from ==UserStyle== header)
				active && decls && decls.length > 0
					? React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "6px", padding: "10px", borderRadius: "8px", background: "rgba(127,127,255,0.06)", border: "1px solid var(--dsw-alias-border-l2, #333)" } },
						React.createElement("div", { style: { fontSize: "12px", fontWeight: 600, color: "var(--dsw-alias-label-secondary, #bbb)" } },
							"配置（来自 ==UserStyle== 声明，改动即时生效）"),
						decls.map(function (decl) {
							return React.createElement("div", { key: decl.name, style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
								React.createElement("span", { style: { fontSize: "12px", color: "var(--dsw-alias-label-primary, #ddd)", minWidth: "120px" } }, decl.label),
								React.createElement(ConfigField, {
									decl: decl,
									value: activeConfig[decl.name],
									onChange: function (v) { updateConfig(decl.name, v); },
									onPickImage: function (fieldName) { pickImage(fieldName); }
								})
							);
						}),
						React.createElement("input", {
							type: "file",
							accept: "image/*,.svg",
							ref: imgInputRef,
							onChange: onImgFile,
							style: { display: "none" }
						})
					)
					: null,

				// css editor
				active
					? React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "6px" } },
						React.createElement("div", { style: { fontSize: "12px", color: "var(--dsw-alias-label-secondary, #bbb)" } },
							"CSS 编辑：\u201C" + active.name + "\u201D（改动即时生效并自动保存；配置面板的改动会写进占位符）"),
						React.createElement("textarea", {
							value: active.css,
							onChange: function (e) { setCss(e.target.value); },
							spellCheck: false,
							placeholder: "/* 在这里写 CSS */",
							style: {
								width: "100%", minHeight: "200px", boxSizing: "border-box",
								fontFamily: "ui-monospace, SFMono-Regular, Consolas, 'Courier New', monospace",
								fontSize: "12px", lineHeight: "18px",
								background: "#16181c",
								color: "#e8e8ea",
								border: "1px solid #3a3a40",
								borderRadius: "8px", padding: "8px", resize: "vertical",
								outline: "none"
							}
						}),
						active.css.trim() === ""
							? React.createElement("div", { style: { fontSize: "11px", color: "#fbbf24" } }, "当前样式内容为空，不会产生任何效果。")
							: null
					)
					: React.createElement("div", { style: { fontSize: "12px", color: "#fbbf24", padding: "10px 12px", borderRadius: "8px", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.35)" } },
						"还没有选中的样式：先点击上方\u201C+ 新建样式\u201D，或点选列表中的一个样式，即可开始编辑。")
			);
		}

		// ══════════════════════════════════════════════════════════════════
		//  plugin entry
		// ══════════════════════════════════════════════════════════════════
		var inject = ["slots"];

		function apply(ctx) {
			syncCss(loadStore());
			var slots = ctx.get("slots");
			if (slots === undefined) return;
			slots.inject("settings.section", function () {
				return slots.register({
					name: "settings.section",
					id: "stylus",
					order: 100,
					label: "样式"
				}, StylusPanel);
			});
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
