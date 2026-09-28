#!/usr/bin/env python3
"""Picture helpers for the write-ups (Pillow + macOS sips for HEIC + ffmpeg for video frames).

  python3 merge/tools/pics.py sheet OUT.jpg FILE...            numbered contact sheet (look at many pictures at once)
  python3 merge/tools/pics.py webp IN OUT.webp [--max 1600] [--q 80]   any picture (HEIC too) → webp, longest side ≤ max
  python3 merge/tools/pics.py frame VIDEO SECONDS OUT.webp [--max 1600]  one video frame → webp
  python3 merge/tools/pics.py frames VIDEO N OUT.jpg            N evenly spaced frames of a video as a contact sheet
  python3 merge/tools/pics.py pdf FILE.pdf OUTDIR [--pages 1-5] [--max 1600]   render PDF pages → OUTDIR/p01.webp …
  python3 merge/tools/pics.py pdfimages FILE.pdf OUTDIR [--min 300]            pull the embedded pictures out of a PDF
  python3 merge/tools/pics.py office FILE.pptx|docx OUTDIR                     pull the embedded pictures out of a pptx / docx
"""
import subprocess, sys, tempfile, pathlib
from PIL import Image, ImageDraw, ImageOps

HEIF = {'.heic', '.heif'}

def load(path):
    p = pathlib.Path(path)
    if p.suffix.lower() in HEIF:                       # Pillow has no HEIC reader here: let sips make a jpeg first
        tmp = pathlib.Path(tempfile.mkdtemp()) / (p.stem + '.jpg')
        subprocess.run(['sips', '-s', 'format', 'jpeg', str(p), '--out', str(tmp)], check=True, capture_output=True)
        p = tmp
    if p.suffix.lower() == '.pdf':                    # first page of a PDF
        import pymupdf
        pg = pymupdf.open(p)[0]; z = 1400 / max(pg.rect.width, pg.rect.height)
        tmp = pathlib.Path(tempfile.mkdtemp()) / (p.stem + '.png'); pg.get_pixmap(matrix=pymupdf.Matrix(z, z)).save(tmp); p = tmp
    im = Image.open(p)
    im = ImageOps.exif_transpose(im)                   # phone photos: honour the rotation flag
    return im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')

def to_webp(src, out, max_side=1600, q=80):
    im = load(src)
    im.thumbnail((max_side, max_side), Image.LANCZOS)
    out = pathlib.Path(out); out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out, 'WEBP', quality=q, method=6)
    return out, im.size, out.stat().st_size

def sheet(out, files, cell=300, cols=None):
    files = list(files); n = len(files)
    cols = cols or min(6, max(1, int(n ** 0.5 + 0.999)))
    rows = (n + cols - 1) // cols
    W, H = cols * cell, rows * (cell + 22)
    canvas = Image.new('RGB', (W, H), (241, 241, 238)); d = ImageDraw.Draw(canvas)
    for i, f in enumerate(files):
        x, y = (i % cols) * cell, (i // cols) * (cell + 22)
        try:
            im = load(f).convert('RGB'); im.thumbnail((cell - 8, cell - 8))
            canvas.paste(im, (x + (cell - im.width) // 2, y + (cell - im.height) // 2))
        except Exception as e:
            d.text((x + 8, y + cell // 2), f'unreadable: {e}'[:40], fill=(160, 0, 0))
        d.text((x + 6, y + cell + 4), f'{i + 1}: {pathlib.Path(f).name}'[:44], fill=(17, 17, 17))
    pathlib.Path(out).parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out, 'JPEG', quality=82)
    for i, f in enumerate(files): print(f'{i + 1}\t{f}')

def pdf_pages(pdf, outdir, pages=None, max_side=1600):
    import pymupdf
    doc = pymupdf.open(pdf); outdir = pathlib.Path(outdir); outdir.mkdir(parents=True, exist_ok=True)
    lo, hi = (1, doc.page_count) if not pages else (int(pages.split('-')[0]), int(pages.split('-')[-1]))
    for n in range(lo, min(hi, doc.page_count) + 1):
        page = doc[n - 1]; zoom = max_side / max(page.rect.width, page.rect.height)
        pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom))
        tmp = outdir / f'p{n:02d}.png'; pix.save(tmp)
        print(*to_webp(tmp, outdir / f'p{n:02d}.webp', max_side)); tmp.unlink()

def pdf_images(pdf, outdir, min_side=300):
    import pymupdf
    doc = pymupdf.open(pdf); outdir = pathlib.Path(outdir); outdir.mkdir(parents=True, exist_ok=True); seen = set()
    for pno, page in enumerate(doc, 1):
        for img in page.get_images(full=True):
            xref = img[0]
            if xref in seen: continue
            seen.add(xref); info = doc.extract_image(xref)
            if min(info['width'], info['height']) < min_side: continue
            raw = outdir / f'p{pno:02d}-x{xref}.{info["ext"]}'; raw.write_bytes(info['image'])
            print(*to_webp(raw, raw.with_suffix('.webp'))); raw.unlink()

def office_images(path, outdir, min_side=300):
    import zipfile
    outdir = pathlib.Path(outdir); outdir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path) as z:
        for name in z.namelist():
            if not ('/media/' in name and name.lower().rsplit('.', 1)[-1] in ('png', 'jpg', 'jpeg', 'gif', 'bmp', 'tif', 'tiff', 'heic', 'webp')): continue
            raw = outdir / pathlib.Path(name).name; raw.write_bytes(z.read(name))
            try:
                w, h = load(raw).size
                if min(w, h) >= min_side: print(*to_webp(raw, raw.with_suffix('.webp')))
            except Exception as e: print('skip', raw.name, e)
            if raw.suffix.lower() != '.webp': raw.unlink()

def frame(video, t, out, max_side=1600):
    tmp = pathlib.Path(tempfile.mkdtemp()) / 'f.png'
    subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(t), '-i', str(video), '-frames:v', '1', str(tmp)], check=True)
    return to_webp(tmp, out, max_side)

def frames(video, n, out):
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(video)],
                               capture_output=True, text=True, check=True).stdout.strip() or 0)
    tmpdir = pathlib.Path(tempfile.mkdtemp()); shots = []
    for i in range(n):
        t = dur * (i + 0.5) / n; p = tmpdir / f't{t:07.2f}s.png'
        subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{t:.2f}', '-i', str(video), '-frames:v', '1', str(p)], check=True)
        shots.append(p)
    sheet(out, shots)

if __name__ == '__main__':
    a = sys.argv[1:]
    if not a: print(__doc__); sys.exit(1)
    opt = lambda k, d: type(d)(a[a.index(k) + 1]) if k in a else d
    pos = [x for i, x in enumerate(a) if not x.startswith('--') and (i == 0 or not a[i - 1].startswith('--'))]
    if a[0] == 'sheet': sheet(pos[1], pos[2:])
    elif a[0] == 'webp': print(*to_webp(pos[1], pos[2], opt('--max', 1600), opt('--q', 80)))
    elif a[0] == 'frame': print(*frame(pos[1], pos[2], pos[3], opt('--max', 1600)))
    elif a[0] == 'frames': frames(pos[1], int(pos[2]), pos[3])
    elif a[0] == 'pdf': pdf_pages(pos[1], pos[2], opt('--pages', ''), opt('--max', 1600))
    elif a[0] == 'pdfimages': pdf_images(pos[1], pos[2], opt('--min', 300))
    elif a[0] == 'office': office_images(pos[1], pos[2])
    else: print(__doc__); sys.exit(1)
