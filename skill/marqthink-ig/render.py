#!/usr/bin/env python3
"""Render slide Marqthink (feed 1080x1350 JPEG) dari spec JSON.

Pakai:
  python3 render.py spec.json --out ./out          # tulis <slug>-1.jpg, <slug>-2.jpg, ...
  python3 render.py spec.json --out ./out --html   # juga simpan HTML untuk debug

Spec:
{
  "slug": "2026-11-24-promptcaption",
  "slides": [
    {"type": "cover", "title": "Caption kamu\\nsepi?", "accent": "Cek dulu brief-nya.", "sub": "..."},
    {"type": "point", "label": "LANGKAH #1", "title": "...", "accent": "...", "body": "...", "num": "01"},
    {"type": "poll", "title": "Marketer,", "accent": "kamu tim mana?", "options": ["...", "..."], "tag": "Jawab di komentar", "cta": "Tulis A atau B"},
    {"type": "list", "label": "RANGKUMAN", "title": "...", "items": ["...", "..."]},
    {"type": "statement", "title": "...", "accent": "...", "sub": "..."},
    {"type": "cta", "title": "...", "accent": "...", "sub": "...", "button": "Follow @marqthink.ai"}
  ]
}
Opsional per slide: "theme": "dark" | "light", "cta": teks pojok kanan bawah, "tag": teks pojok kanan atas.
Default tema: slide pertama & terakhir dark, sisanya light. Single image = 1 slide.
Baris baru di title/accent pakai \\n. Teks dianggap teks biasa (di-escape).
"""
import argparse, base64, html, json, pathlib, sys

HERE = pathlib.Path(__file__).resolve().parent
W, H = 1080, 1350


def b64(p):
    return base64.b64encode((HERE / p).read_bytes()).decode()


def font_css():
    faces = [
        ("Montserrat", "fonts/Montserrat.ttf", "100 900", "truetype"),
        ("Inter", "fonts/Inter-Regular.otf", "400", "opentype"),
        ("Inter", "fonts/Inter-Medium.otf", "500", "opentype"),
        ("Inter", "fonts/Inter-SemiBold.otf", "600", "opentype"),
        ("Inter", "fonts/Inter-Bold.otf", "700", "opentype"),
    ]
    return "\n".join(
        f"@font-face{{font-family:'{f}';src:url(data:font/{fmt};base64,{b64(p)}) format('{fmt}');font-weight:{w};}}"
        for f, p, w, fmt in faces
    )


def t(s):
    return html.escape(str(s or "")).replace("\\n", "<br>").replace("\n", "<br>")


CSS = """
*{box-sizing:border-box;margin:0;padding:0}
body{background:#000}
.s{width:1080px;height:1350px;position:relative;overflow:hidden;font-family:Inter,sans-serif;display:flex;flex-direction:column;padding:96px 96px 88px}
.dark{background:#0A0F23;color:#fff}
.dark:before{content:"";position:absolute;right:-260px;top:-300px;width:1000px;height:1000px;border-radius:50%;
  background:radial-gradient(circle,rgba(10,61,255,.95) 0%,rgba(10,61,255,.45) 38%,rgba(10,15,35,0) 70%)}
.dark.alt:before{right:auto;left:-300px;top:auto;bottom:-420px;background:radial-gradient(circle,rgba(0,229,255,.35) 0%,rgba(10,61,255,.35) 35%,rgba(10,15,35,0) 70%)}
.light{background:#F7F8FC;color:#0A0F24}
.top,.bot{display:flex;justify-content:space-between;align-items:center;position:relative;z-index:2}
.top img{height:58px}
.dark .top img{height:74px;margin:-8px 0}
.top .tag,.bot .h{font-size:26px;color:#8A93A8}
.dark .top .tag,.dark .bot .h{color:#7C86A6}
.bot .c{font-size:28px;font-weight:600;color:#0A84FF}
.main{flex:1;display:flex;flex-direction:column;justify-content:center;position:relative;z-index:2}
h1{font-family:Montserrat;font-weight:800;font-size:100px;line-height:1.04;letter-spacing:-1.5px}
h2{font-family:Montserrat;font-weight:800;font-size:76px;line-height:1.08;letter-spacing:-1px}
.acc{background:linear-gradient(90deg,#0A3DFF 0%,#0A84FF 55%,#00E5FF 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.dark .acc{background:linear-gradient(90deg,#1E5BFF 0%,#0A84FF 50%,#00E5FF 100%);-webkit-background-clip:text;background-clip:text}
.sub{margin-top:44px;font-size:36px;line-height:1.45;color:#5B6478;max-width:860px}
.dark .sub{color:#B4BCD3}
.label{align-self:flex-start;font-size:24px;font-weight:700;letter-spacing:2px;color:#0A3DFF;background:#E3ECFF;padding:10px 20px;border-radius:999px;margin-bottom:36px}
.dark .label{background:rgba(10,132,255,.18);color:#7CC4FF}
.num{position:absolute;right:40px;bottom:60px;font-family:Montserrat;font-weight:800;font-size:420px;line-height:1;color:transparent;-webkit-text-stroke:3px #E3E8F2;z-index:1}
.opts{margin-top:64px;display:flex;flex-direction:column;gap:32px}
.opt{display:flex;align-items:center;gap:36px;background:#fff;border:2px solid #E3E8F2;border-radius:32px;padding:40px}
.opt:nth-child(2){background:#E8F6FF;border-color:#C9E6FF}
.opt b{flex:none;width:104px;height:104px;border-radius:24px;display:flex;align-items:center;justify-content:center;font-family:Montserrat;font-weight:800;font-size:52px;color:#fff;background:#0A0F24}
.opt:nth-child(2) b{background:linear-gradient(135deg,#0A3DFF,#00E5FF)}
.opt:nth-child(3) b{background:#0A84FF}
.opt span{font-size:40px;font-weight:600;line-height:1.3}
.list{margin-top:56px;display:flex;flex-direction:column;gap:28px}
.it{display:flex;gap:28px;align-items:flex-start;font-size:38px;line-height:1.35;font-weight:500}
.it i{flex:none;width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,#0A3DFF,#00E5FF);display:flex;align-items:center;justify-content:center;margin-top:-2px}
.dark .it{color:#E6EAF5}
.btn{margin-top:64px;align-self:flex-start;font-size:36px;font-weight:700;color:#fff;padding:28px 48px;border-radius:999px;background:linear-gradient(90deg,#0A3DFF,#0A84FF 60%,#00E5FF)}
"""

CHECK = '<svg width="30" height="30" viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'


def heading(s, tag="h1"):
    title, acc = s.get("title"), s.get("accent")
    inner = t(title)
    if acc:
        inner += ("<br>" if title else "") + f'<span class="acc">{t(acc)}</span>'
    return f"<{tag}>{inner}</{tag}>"


def slide(s, i, n, logos):
    kind = s.get("type", "statement")
    theme = s.get("theme") or ("dark" if i in (0, n - 1) else "light")
    cls = f"s {theme}" + (" alt" if theme == "dark" and i == n - 1 and n > 1 else "")
    tag = s.get("tag") or (f"{i + 1}/{n}" if n > 1 else "")
    cta = s.get("cta")
    if cta is None:
        cta = "Geser →" if (n > 1 and i < n - 1) else ""
    big = kind in ("cover", "statement")
    body = ""
    if s.get("label"):
        body += f'<div class="label">{t(s["label"])}</div>'
    body += heading(s, "h1" if big else "h2")
    if kind == "poll":
        body += '<div class="opts">' + "".join(
            f"<div class='opt'><b>{'ABC'[k]}</b><span>{t(o)}</span></div>" for k, o in enumerate(s.get("options", [])[:3])
        ) + "</div>"
    if kind == "list":
        body += '<div class="list">' + "".join(f"<div class='it'><i>{CHECK}</i><div>{t(x)}</div></div>" for x in s.get("items", [])) + "</div>"
    for key in ("sub", "body"):
        if s.get(key):
            body += f'<p class="sub">{t(s[key])}</p>'
    if kind == "cta" and s.get("button"):
        body += f'<div class="btn">{t(s["button"])}</div>'
    num = f'<div class="num">{t(s["num"])}</div>' if s.get("num") and theme == "light" else ""
    logo = logos[theme]
    return f"""<section class="{cls}">{num}
<div class="top"><img src="data:image/png;base64,{logo}"><span class="tag">{t(tag)}</span></div>
<div class="main">{body}</div>
<div class="bot"><span class="h">@marqthink.ai</span><span class="c">{t(cta)}</span></div></section>"""


def build_html(spec):
    logos = {"dark": b64("assets/logo-dark.png"), "light": b64("assets/logo-light.png")}
    slides = spec["slides"]
    secs = "\n".join(slide(s, i, len(slides), logos) for i, s in enumerate(slides))
    return f"<!doctype html><html><head><meta charset='utf-8'><style>{font_css()}{CSS}</style></head><body>{secs}</body></html>"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("spec")
    ap.add_argument("--out", default=".")
    ap.add_argument("--html", action="store_true")
    a = ap.parse_args()
    spec = json.loads(pathlib.Path(a.spec).read_text())
    if not 1 <= len(spec.get("slides", [])) <= 10:
        sys.exit("FAIL: slides harus 1-10")
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    doc = build_html(spec)
    if a.html:
        (out / f"{spec['slug']}.html").write_text(doc)
    from playwright.sync_api import sync_playwright
    from PIL import Image
    import io

    files = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
        pg.set_content(doc, wait_until="load")
        pg.evaluate("document.fonts.ready")
        secs = pg.query_selector_all("section")
        n = len(secs)
        for i, el in enumerate(secs):
            png = el.screenshot(type="png")
            name = f"{spec['slug']}-{i + 1}.jpg" if n > 1 else f"{spec['slug']}.jpg"
            Image.open(io.BytesIO(png)).convert("RGB").save(out / name, "JPEG", quality=90, optimize=True, progressive=True)
            files.append(str(out / name))
        b.close()
    print(json.dumps(files))


if __name__ == "__main__":
    main()
