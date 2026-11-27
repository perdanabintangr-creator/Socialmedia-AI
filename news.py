"""Marqthink NEWS renderer (gaya homeless media, latar gelap). 1080x1350 JPG.

usage: python3 news.py spec.json OUT_DIR
Spec:
{
  "id": "news-2026-11-26",            # prefix nama file -> news-2026-11-26_1.jpg ...
  "date_label": "Kamis, 26 Nov 2026",
  "region": "INDONESIA" | "GLOBAL",
  "src": "Sumber: Kontan, Katadata",  # tampil di kaki setiap slide
  "slides": [
    {"type": "cover", "prop": "globe", "cat": "PLATFORM · META", "hl": "Teks dengan [[stabilo]].", "nx": "Kalimat menggantung..."},
    {"type": "point", "prop": "chart_up", "cat": "...", "hl": "...", "nx": "..."},
    {"type": "big",   "big": "5–10%", "cat": "...", "hl": "...", "nx": "..."},
    {"type": "artinya", "hl": "Judul pendek", "items": ["poin 1", "poin 2", "poin 3"], "nx": "..."},
    {"type": "cta", "hl": "Kamu udah coba fitur ini?", "q": "Jawab di komentar"}
  ]
}
[[...]] = stabilo cyan. Prop = nama file di props/ (tanpa .png). Setiap slide wajib prop BEDA.
Skrip mencetak WARN kalau teks meluber atau menabrak objek; perbaiki teks lalu render ulang.
"""
import json, sys, os, re, html
from playwright.sync_api import sync_playwright
from PIL import Image

K = os.path.dirname(os.path.abspath(__file__))
spec = json.load(open(sys.argv[1])); OUT = os.path.abspath(sys.argv[2]); os.makedirs(OUT, exist_ok=True)
F = lambda p: 'file://' + os.path.join(K, p)

CSS = f'''<style>
@font-face{{font-family:Tight;src:url('{F("fonts/inter-tight-latin-wght-normal.woff2")}');font-weight:100 900}}
@font-face{{font-family:Serif;font-style:italic;src:url('{F("fonts/instrument-serif-latin-400-italic.woff2")}')}}
@font-face{{font-family:Hand;src:url('{F("fonts/caveat-latin-600-normal.woff2")}')}}
*{{margin:0;padding:0;box-sizing:border-box}} body{{background:#333}}
.s{{width:1080px;height:1350px;position:relative;overflow:hidden;background:#05070F;color:#fff;font-family:Tight}}
.glow{{position:absolute;border-radius:50%;opacity:.6}}
.top{{position:absolute;left:56px;right:56px;top:52px;display:flex;justify-content:space-between;align-items:center;z-index:8;font-size:22px;font-weight:700}}
.pills{{display:flex;align-items:center;gap:12px}}
.pill{{font-size:18px;font-weight:800;letter-spacing:.1em;padding:7px 14px;border-radius:30px}}
.fade{{position:absolute;left:0;right:0;bottom:0;height:760px;background:linear-gradient(180deg,rgba(5,7,15,0) 0%,rgba(5,7,15,.9) 42%,#05070F 70%);z-index:3}}
.txt{{position:absolute;left:56px;right:56px;bottom:130px;z-index:5}}
.cat{{font-size:21px;font-weight:700;letter-spacing:.16em;color:#00E5FF}}
.hl{{font-weight:820;line-height:1.05;letter-spacing:-.035em;margin-top:18px}}
.nx{{font-family:Serif;font-style:italic;font-size:38px;color:#9FB4E8;margin-top:24px;line-height:1.15}}
.foot{{position:absolute;left:56px;right:56px;bottom:52px;display:flex;justify-content:space-between;font-size:19px;color:rgba(255,255,255,.45);z-index:5}}
mark{{background:#00E5FF;color:#05070F;padding:0 12px;border-radius:6px;box-decoration-break:clone;-webkit-box-decoration-break:clone}}
.prop{{position:absolute;z-index:2;filter:drop-shadow(0 50px 60px rgba(0,0,0,.55))}}
.big{{position:absolute;left:0;right:0;top:170px;text-align:center;z-index:2;font-weight:900;letter-spacing:-.06em;line-height:1;background:linear-gradient(160deg,#fff 10%,#00E5FF 55%,#6A3BFF);-webkit-background-clip:text;color:transparent}}
.item{{display:flex;gap:22px;align-items:flex-start;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:26px;padding:26px 30px;margin-top:16px;font-size:34px;font-weight:600;line-height:1.3}}
.item b{{flex:0 0 auto;width:52px;height:52px;border-radius:50%;background:#00E5FF;color:#05070F;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:900}}
</style>'''

GLOWS = ['#0A3DFF', '#6A3BFF', '#00A3D9', '#0A3DFF', '#3B1BD6', '#00A3D9']
def mk(t): return re.sub(r'\[\[(.+?)\]\]', r'<mark>\1</mark>', html.escape(t, quote=False))
def hsize(t):
    n = len(re.sub(r'\[\[|\]\]', '', t))
    return 80 if n <= 50 else 72 if n <= 70 else 64 if n <= 95 else 56 if n <= 125 else 50

slides = spec['slides']; tot = len(slides); S = []
LIGHT = spec.get('theme') == 'light'
LABEL = spec.get('label', 'NEWS')
if LIGHT:
    CSS = CSS.replace('background:#05070F;color:#fff', 'background:#F5F6FB;color:#0A0F24') \
      .replace('rgba(5,7,15,0) 0%,rgba(5,7,15,.9) 42%,#05070F 70%', 'rgba(245,246,251,0) 0%,rgba(245,246,251,.92) 40%,#F5F6FB 68%') \
      .replace('.cat{{font-size:21px;font-weight:700;letter-spacing:.16em;color:#00E5FF}}'.replace('{{','{').replace('}}','}'), '.cat{font-size:21px;font-weight:700;letter-spacing:.16em;color:#0A3DFF}') \
      .replace('color:#9FB4E8', 'color:#5B6478') \
      .replace('color:rgba(255,255,255,.45)', 'color:rgba(10,15,36,.45)') \
      .replace('mark{background:#00E5FF;color:#05070F', 'mark{background:#0A3DFF;color:#fff') \
      .replace('rgba(0,0,0,.55)', 'rgba(10,30,90,.22)') \
      .replace('background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1)', 'background:#fff;border:1px solid #E3E8F2') \
      .replace('.item b{flex:0 0 auto;width:52px;height:52px;border-radius:50%;background:#00E5FF;color:#05070F', '.item b{flex:0 0 auto;width:52px;height:52px;border-radius:50%;background:#0A3DFF;color:#fff') \
      .replace('background:linear-gradient(160deg,#fff 10%,#00E5FF 55%,#6A3BFF)', 'background:linear-gradient(160deg,#0A3DFF 10%,#6A3BFF 60%,#00BEFF)')
    GLOWS = ['#9FB8FF', '#C9B8FF', '#A8E6FF', '#B8C8FF', '#D4C8FF', '#A8E6FF']
reg = spec.get('region', 'INDONESIA').upper()
regpill = '' if not reg else (f'<span class="pill" style="background:{"#0A0F24" if LIGHT else "#fff"};color:{"#fff" if LIGHT else "#05070F"}">{reg}</span>' if reg == 'INDONESIA'
           else f'<span class="pill" style="border:2px solid rgba(255,255,255,.6);padding:5px 12px">{reg}</span>')
for i, s in enumerate(slides, 1):
    t = s['type']; g = GLOWS[(i - 1) % len(GLOWS)]
    body = f'<div class="glow" style="left:{90 + (i % 3) * 60}px;top:-40px;width:900px;height:900px;background:radial-gradient(circle,{g} 0%,transparent 65%)"></div>'
    if s.get('prop'):
        p = os.path.join(K, 'props', s['prop'] + '.png'); w, h = Image.open(p).size
        mx = (440, 330) if t == 'artinya' else (640, 600)
        sc = min(mx[0] / w, mx[1] / h); W, H = int(w * sc), int(h * sc)
        rot = [-6, 5, -3, 7, -5, 3][(i - 1) % 6]
        body += f'<img class="prop" id="p{i}" src="file://{p}" style="left:{(1080 - W) // 2}px;top:{(150 + (330 - H) // 2) if t == 'artinya' else (150 + (600 - H) // 2)}px;width:{W}px;transform:rotate({rot}deg)">'
    if t == 'big':
        n = len(s['big']); fs = 300 if n <= 4 else 250 if n <= 6 else 190
        body += f'<div class="big" id="p{i}" style="font-size:{fs}px">{html.escape(s["big"])}</div>'
    body += '<div class="fade"></div>'
    pg = f'{i}/{tot}'
    body += (f'<div class="top"><div class="pills"><img src="{F("brand/logo-light.png" if LIGHT else "brand/logo-dark.png")}" style="height:52px">'
             f'<span class="pill" style="background:{"#0A3DFF" if LIGHT else "#00E5FF"};color:{"#fff" if LIGHT else "#05070F"}">{LABEL}</span>{regpill}</div>'
             f'<div style="color:{"rgba(10,15,36,.5)" if LIGHT else "rgba(255,255,255,.55)"}">{pg}</div></div>')
    if t == 'artinya':
        items = ''.join(f'<div class="item"><b>{k}</b><div>{mk(x)}</div></div>' for k, x in enumerate(s['items'], 1))
        body += (f'<div class="txt" id="t{i}" style="bottom:130px"><div class="cat">ARTINYA BUAT KAMU</div>'
                 f'<div class="hl" style="font-size:{min(hsize(s["hl"]), 68)}px">{mk(s["hl"])}</div>{items}'
                 + (f'<div class="nx">{mk(s["nx"])}</div>' if s.get('nx') else '') + '</div>')
        right = 'Geser →'
    elif t == 'cta':
        body += (f'<img class="prop" id="p{i}" src="{F("props/logo_q.png")}" style="left:330px;top:190px;width:420px">'
                 f'<div class="txt" id="t{i}"><div class="cat">{html.escape(s.get("cat", "UPDATE MARKETING TIAP PAGI, JAM 7"))}</div>'
                 f'<div class="hl" style="font-size:{hsize(s["hl"])}px">{mk(s["hl"])}</div>'
                 f'<div class="nx">{mk(s.get("q", "Jawab di komentar ya."))}</div></div>')
        right = 'Follow @marqthink.ai'
    else:
        date = f'<div style="font-size:22px;font-weight:700;color:{"#5B6478" if LIGHT else "rgba(255,255,255,.6)"};margin-bottom:14px">{html.escape(spec.get("date_label", ""))}</div>' if t == 'cover' else ''
        body += (f'<div class="txt" id="t{i}">{date}<div class="cat">{html.escape(s.get("cat", ""))}</div>'
                 f'<div class="hl" style="font-size:{hsize(s["hl"])}px">{mk(s["hl"])}</div>'
                 + (f'<div class="nx">{mk(s["nx"])}</div>' if s.get('nx') else '') + '</div>')
        right = 'Geser →' if i < tot else 'Jawab di komentar'
    body += f'<div class="foot"><div>{html.escape(spec.get("src", ""))}</div><div>{right}</div></div>'
    S.append(f'<div class="s" id="s{i}">{body}</div>')

page = os.path.join(OUT, '_news.html')
open(page, 'w').write('<html><head><meta charset="utf-8">' + CSS + '</head><body>' + ''.join(S) + '</body></html>')
with sync_playwright() as pw:
    b = pw.chromium.launch(); pg = b.new_page(viewport={'width': 1080, 'height': 1350})
    pg.goto('file://' + page); pg.wait_for_timeout(1200)
    for i in range(1, tot + 1):
        r = pg.evaluate(f'''()=>{{const t=document.getElementById("t{i}").getBoundingClientRect(),s=document.getElementById("s{i}").getBoundingClientRect();
          const p=document.getElementById("p{i}");const pb=p?p.getBoundingClientRect():null;
          return {{top:t.top-s.top, pbot:pb?pb.bottom-s.top:0}}}}''')
        if r['top'] < 150: print(f'WARN slide {i}: teks terlalu panjang (mulai y={r["top"]:.0f}); pendekkan.')
        elif r['pbot'] and r['top'] < r['pbot'] - 160: print(f'WARN slide {i}: teks menutupi objek (teks y={r["top"]:.0f}, objek s/d y={r["pbot"]:.0f}); pendekkan.')
        fn = os.path.join(OUT, f'{spec["id"]}_{i}')
        pg.locator(f'#s{i}').screenshot(path=fn + '.png')
        Image.open(fn + '.png').convert('RGB').save(fn + '.jpg', quality=90); os.remove(fn + '.png')
        print(fn + '.jpg')
    b.close()
