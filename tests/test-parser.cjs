// Standalone unit test for the dsh-stylus parser/render logic.
// Mirrors the functions embedded in lib/client.js (kept in sync by hand).

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
	var dropRe = /@advanced\s+dropdown\s+([\w-]+)\s+"([^"]*)"\s*\{([\s\S]*?)\n\s*\}/g;
	var dropMatch;
	while ((dropMatch = dropRe.exec(body)) !== null) {
		var options = [];
		var optRe = /([\w-]+)\s+"([^"]*)"\s+<<<EOT([\s\S]*?)EOT;/g;
		var optMatch;
		while ((optMatch = optRe.exec(dropMatch[3])) !== null) {
			options.push({ key: optMatch[1], label: optMatch[2], value: optMatch[3].trim().replace(/\\\//g, "/") });
		}
		if (options.length === 0) continue;
		decls.push({ type: "dropdown", name: dropMatch[1], label: dropMatch[2], options: options, pos: dropMatch.index });
	}
	var simpleRe = /@advanced\s+(text|textarea|color|checkbox)\s+([\w-]+)\s+"([^"]*)"\s*(.*)$/gm;
	var simpleMatch;
	while ((simpleMatch = simpleRe.exec(body)) !== null) {
		decls.push({ type: simpleMatch[1], name: simpleMatch[2], label: simpleMatch[3], defaultValue: unquote(simpleMatch[4]), pos: simpleMatch.index });
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

// ── test fixture (mirrors BLACKED_TEMPLATE's UserStyle header) ──
const css = `/* ==UserStyle==
@name           X blacked
@advanced dropdown bg "背景图" {
  builtin "内置图（需联网）" <<<EOT url("https://pbs.twimg.com/media/x.jpg") EOT;
  custom "本地图片（选下方 bg-custom）" <<<EOT url("/*[[bg-custom]]*\/") EOT;
}
@advanced text bg-custom "自定义背景图（URL 或点选图）" ""
@advanced color theme-color "主题色" #00853e
@advanced dropdown blur "背景模糊" {
  on "模糊" <<<EOT 2px EOT;
  off "清晰" <<<EOT 0px EOT;
}
==/UserStyle== */
:root { --dshx-bg-image: /*[[bg]]*/; --dshx-green: /*[[theme-color]]*/; }
body::before { filter: blur(/*[[blur]]*/); }`;

let pass = 0, fail = 0;
function check(name, cond, extra) {
	if (cond) { pass++; console.log("  ✓ " + name); }
	else { fail++; console.log("  ✗ " + name + (extra !== undefined ? "  →  " + JSON.stringify(extra) : "")); }
}

const decls = parseUserStyle(css);
console.log("parseUserStyle:");
check("parses 4 decls", decls && decls.length === 4, decls && decls.length);
check("decl[0] is dropdown bg", decls[0].type === "dropdown" && decls[0].name === "bg");
check("bg has 2 options", decls[0].options.length === 2, decls[0].options.length);
check("custom option value unescapes *\\/ and nests placeholder",
	decls[0].options[1].value === 'url("/*[[bg-custom]]*/")', decls[0].options[1].value);
check("decl[1] is text bg-custom with empty default", decls[1].type === "text" && decls[1].name === "bg-custom" && decls[1].defaultValue === "");
check("decl[2] is color theme-color", decls[2].type === "color" && decls[2].defaultValue === "#00853e");
check("decl[3] is dropdown blur with 2 options", decls[3].type === "dropdown" && decls[3].options.length === 2);

const def = defaultConfig(decls);
console.log("defaultConfig:");
check("defaults bg=builtin", def.bg === "builtin");
check("defaults blur=on", def.blur === "on");
check("defaults theme-color=#00853e", def["theme-color"] === "#00853e");

console.log("renderCss:");
const rendered = renderCss(css, buildRenderConfig(decls, Object.assign({}, def, {
	bg: "custom",
	"bg-custom": "data:image/png;base64,AAA",
	"theme-color": "#ff0000"
})));
check("bg custom → nested data url", rendered.indexOf('--dshx-bg-image: url("data:image/png;base64,AAA");') !== -1, rendered.match(/--dshx-bg-image: [^;]+/));
check("theme-color replaced", rendered.indexOf("--dshx-green: #ff0000;") !== -1);
check("blur replaced (on→2px)", rendered.indexOf("filter: blur(2px);") !== -1);
check("no leftover placeholders", !/\/\*\[\[[\w-]+\]\]\*\//.test(rendered), rendered.match(/\/\*\[\[[\w-]+\]\]\*\//g));

console.log("rgbToHex / colorInputValue:");
check("rgb(0,133,62) → #00853e", rgbToHex("rgb(0,133,62)") === "#00853e");
check("rgba(227,28,35,0.8) → #e31c23", rgbToHex("rgba(227,28,35,0.8)") === "#e31c23");
check("colorInputValue passes hex through", colorInputValue("#abc123", "#000") === "#abc123");
check("colorInputValue converts rgb", colorInputValue("rgb(0,133,62)", "#000") === "#00853e");
check("colorInputValue falls back", colorInputValue("notacolor", "#111111") === "#111111");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
