#!/usr/bin/env python3
"""Linter + humanizer caption Marqthink (adaptasi ig-caption & ig-human dari Instagram Agent Skill, MIT).

Pakai:
  python3 lint.py caption.txt                    # cek caption
  python3 lint.py caption.txt --fix              # bersihkan karakter tak terlihat, em dash, kutip miring (tulis ulang file)
  python3 lint.py caption.txt --spec spec.json   # sekalian cek teks slide
  python3 lint.py caption.txt --date 2026-11-24  # aturan pra/pasca rilis 1 Des 2026

Keluar dengan kode 1 jika ada FAIL. WARN harus diputuskan (perbaiki atau sebutkan alasannya).
"""
import argparse, json, re, sys, unicodedata, datetime as dt

LAUNCH = dt.date(2026, 12, 1)
KEYWORDS = ["ai marketing", "asisten ai", "tools ai", "caption", "prompt", "umkm", "marketer", "konten", "brief", "marketing"]
SLOP = [
    "di era digital", "di era modern", "era serba cepat", "dunia yang serba", "tidak dapat dipungkiri", "tak dapat dipungkiri",
    "mari kita", "simak sampai habis", "simak selengkapnya", "jangan lupa like", "like dan share", "tag teman", "tag temanmu",
    "game changer", "game-changer", "revolusioner", "merevolusi", "solusi terbaik", "solusi tepat", "rahasia sukses",
    "kunci sukses", "wajib tahu", "maksimalkan potensi", "potensi penuh", "secara signifikan", "tak terbatas", "tanpa batas",
    "luar biasa", "sangat penting", "perlu diingat", "pada akhirnya", "dengan kata lain", "tidak hanya itu", "lebih dari sekadar",
    "dalam hitungan detik", "100%", "dijamin", "pasti viral", "auto viral", "seamless", "leverage", "delve", "unlock",
    "elevate", "next level", "stop scrolling", "berhenti scroll", "follow for more", "link di bio",
]
BAD_TAGS = {"#fyp", "#viral", "#explore", "#explorepage", "#foryou", "#foryoupage", "#trending"}
CTA = [r"\bkomen", r"\bkomentar", r"\bsimpan\b", r"\bsave\b", r"\bfollow\b", r"\bikuti\b", r"notifikasi", r"\bshare\b",
       r"\bbagikan\b", r"\bkirim ke\b", r"\bdaftar\b", r"\bdm\b"]
INVIS = re.compile("[​-‏⁠-⁤­﻿‪-‮\U000e0000-\U000e007f]")
EMOJI = re.compile("[\U0001F300-\U0001FAFF☀-➿]")


def fix(s):
    s = INVIS.sub("", s)
    s = s.replace(" ", " ").replace(" ", " ")
    s = re.sub(r"\s*—\s*", ", ", s)          # em dash -> koma
    s = s.replace("–", "-").replace("…", "...")
    s = s.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
    s = re.sub(r",\s*([.!?])", r"\1", s)
    return s


def lint(cap, date=None):
    fails, warns = [], []
    low = cap.lower()
    if INVIS.search(cap) or " " in cap:
        fails.append("ada karakter tak terlihat (jalankan --fix)")
    if "—" in cap or "–" in cap:
        fails.append("ada em/en dash (ciri tulisan AI) - jalankan --fix atau tulis ulang")
    if len(cap) > 2200:
        fails.append(f"panjang {len(cap)} > 2200 karakter")
    elif len(cap) > 900:
        warns.append(f"panjang {len(cap)} karakter; caption 300-700 biasanya cukup")
    first = cap.strip().split("\n")[0]
    if first[:1] == "#" or EMOJI.match(first[:2] or " "):
        fails.append("baris pertama dibuka hashtag/emoji")
    if re.match(r"(?i)(halo|hai|hi|selamat (pagi|siang|sore|malam))\b", first):
        fails.append("baris pertama dibuka sapaan; langsung ke hook/inti")
    vis = cap.strip()[:125]
    if not any(k in vis.lower() for k in KEYWORDS):
        warns.append("125 karakter pertama belum memuat kata kunci (AI marketing / caption / prompt / UMKM ...)")
    if re.search(r"https?://|www\.|\.com\b|\.id\b", re.sub(r"@marqthink\.ai", "", low)):
        fails.append("ada link di caption (tidak bisa diklik; taruh di bio)")
    tags = re.findall(r"#\w+", cap)
    if len(tags) > 5:
        fails.append(f"{len(tags)} hashtag; Instagram membatasi 5")
    elif len(tags) < 3:
        warns.append(f"hanya {len(tags)} hashtag; brand guide: 4-5 termasuk #Marqthink")
    if "#Marqthink" not in tags:
        fails.append("hashtag #Marqthink (ejaan persis) wajib ada")
    for tg in tags:
        if tg.lower() in BAD_TAGS:
            fails.append(f"hashtag tidak berguna: {tg}")
    body = re.sub(r"[#@][\w.]+", "", cap)
    for m in re.finditer(r"(?i)marq\s*think", body):
        if m.group(0) != "Marqthink":
            fails.append(f"ejaan brand salah: '{m.group(0)}' (harus Marqthink)")
    if re.search(r"\bAnda\b", cap):
        warns.append("pakai 'Anda'; tone Marqthink pakai 'kamu'")
    for w in SLOP:
        if w in low:
            warns.append(f"frasa klise/AI: '{w}'")
    n_cta = sum(1 for p in CTA if re.search(p, low))
    if n_cta > 2:
        warns.append(f"{n_cta} jenis ajakan (CTA); pilih satu ajakan utama")
    if n_cta == 0:
        warns.append("tidak ada ajakan (komen/simpan/follow/notifikasi)")
    em = len(EMOJI.findall(cap))
    if len(cap) and em / len(cap) * 100 > 4:
        warns.append(f"emoji terlalu banyak ({em})")
    if date:
        d = dt.date.fromisoformat(date)
        if d < LAUNCH and re.search(r"(?i)daftar (beta|sekarang)|sudah bisa dipakai|coba sekarang", cap):
            fails.append("pra-rilis (sebelum 1 Des 2026): jangan ajak daftar/coba produk; ajak follow/notifikasi")
    return fails, warns


def lint_spec(spec):
    fails, warns = [], []
    sl = spec.get("slides", [])
    if len(sl) > 1 and not 5 <= len(sl) <= 10:
        warns.append(f"carousel {len(sl)} slide; ideal 5-10")
    for i, s in enumerate(sl, 1):
        head = " ".join(str(s.get(k, "")) for k in ("title", "accent")).replace("\\n", " ")
        nw = len(head.split())
        lim = 10 if i == 1 else 9
        if nw > lim:
            warns.append(f"slide {i}: judul {nw} kata (maks ~{lim})")
        for k in ("sub", "body"):
            if s.get(k) and len(str(s[k]).split()) > 25:
                fails.append(f"slide {i}: {k} {len(str(s[k]).split())} kata > 25; pecah jadi 2 slide")
        txt = json.dumps(s, ensure_ascii=False)
        if "—" in txt:
            fails.append(f"slide {i}: ada em dash")
        for m in re.finditer(r"(?i)marq\s*think", txt):
            if m.group(0) not in ("Marqthink", "marqthink"):
                fails.append(f"slide {i}: ejaan brand '{m.group(0)}'")
    return fails, warns


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("caption")
    ap.add_argument("--fix", action="store_true")
    ap.add_argument("--spec")
    ap.add_argument("--date")
    a = ap.parse_args()
    cap = open(a.caption, encoding="utf-8").read()
    if a.fix:
        cap = fix(cap)
        open(a.caption, "w", encoding="utf-8").write(cap)
    cap = unicodedata.normalize("NFC", cap)
    f, w = lint(cap, a.date)
    if a.spec:
        f2, w2 = lint_spec(json.load(open(a.spec, encoding="utf-8")))
        f += f2; w += w2
    print("TERLIHAT SEBELUM '... selengkapnya':")
    print("  | " + cap.strip()[:125].replace("\n", " / "))
    for x in f:
        print("FAIL  " + x)
    for x in w:
        print("WARN  " + x)
    print("HASIL: " + ("SIAP" if not f else "PERBAIKI") + f"  ({len(f)} fail, {len(w)} warn, {len(cap)} karakter)")
    sys.exit(1 if f else 0)


if __name__ == "__main__":
    main()
