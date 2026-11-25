# Marqthink NEWS kit (rubrik berita harian, gaya homeless media)

Render: `python3 news.py spec.json OUT_DIR` -> `OUT_DIR/<id>_1.jpg ...` (1080x1350).
Format spec ada di docstring `news.py`; contoh di `example-spec.json`.
Butuh: python3 + playwright + chromium (sudah ada di environment; kalau tidak: `pip install --break-system-packages playwright pillow`).

Props (props/*.png, objek 3D transparan): basket, battery, box_open, bubble, bulb, cal, chart_down, chart_up, chip (AI),
env (amplop/email), gift, globe, keys (Ctrl C V), logo_q, mag (riset/cek), mega (pengumuman), parcel, pencil, phone_land (video/layar),
piggy (budget/hemat), pin (lokasi/lokal), qmark, reel (video pendek), slices (story/carousel), video.
Setiap slide dalam satu post wajib prop berbeda. Slide `big` memakai angka besar, bukan prop.

Aturan desain: latar gelap #05070F HANYA untuk berita. Stabilo cyan [[...]] maks 1 per slide.
Copy bersambung: setiap `nx` kalimat menggantung yang mengarah ke slide berikutnya.
