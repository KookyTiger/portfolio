#!/usr/bin/env python3
"""Photo → transparent cut-out (panel) + ink silhouette with paper-coloured window holes (card).
usage: cutout.py <photo> <slug> [--crop x0,y0,x1,y1 (fractions)] [--hole green|bright|none] [--out dir] [--flat]
--flat: keep the picture whole (screenshots, slides, icons, labels — anything that is already a flat graphic), no background removal, no silhouette."""
import sys, os, argparse, numpy as np
from PIL import Image, ImageOps, ImageFilter
from scipy import ndimage
import cv2
ap=argparse.ArgumentParser(); ap.add_argument('photo'); ap.add_argument('slug'); ap.add_argument('--crop', default=None); ap.add_argument('--hole', default='none'); ap.add_argument('--out', default='.')
ap.add_argument('--model', default='isnet-general-use'); ap.add_argument('--flat', action='store_true'); A=ap.parse_args()
im=ImageOps.exif_transpose(Image.open(A.photo)); im=im.convert('RGBA') if A.flat else im.convert('RGB')
if A.crop:
    fx0,fy0,fx1,fy1=[float(v) for v in A.crop.split(',')]; im=im.crop((int(fx0*im.width),int(fy0*im.height),int(fx1*im.width),int(fy1*im.height)))
if A.flat: cut=im
else:
    from rembg import remove, new_session
    cut=remove(im, session=new_session(A.model))
a=np.array(cut); al=a[:,:,3]; ys,xs=np.where(al>8)
pad=int(0.04*max(cut.size)); cut=cut.crop((max(0,xs.min()-pad),max(0,ys.min()-pad),min(cut.width,xs.max()+pad),min(cut.height,ys.max()+pad)))
w=min(1400,cut.width); img=cut.resize((w, round(cut.height*w/cut.width)), Image.LANCZOS)
img.save(os.path.join(A.out, f'{A.slug}.png'), optimize=True); pw=min(960,img.width); img.resize((pw, round(img.height*pw/img.width)), Image.LANCZOS).save(os.path.join(A.out, f'{A.slug}.webp'), quality=86, method=6)
def onpaper(p):
    bg=Image.new('RGBA', p.size, (241,241,238,255)); bg.alpha_composite(p); return bg.convert('RGB')
if A.flat:
    onpaper(img).resize((560, round(img.height*560/img.width))).save(os.path.join(A.out, f'sheet-{A.slug}.jpg'), quality=90)
    print(A.slug, 'flat', img.size, os.path.getsize(os.path.join(A.out, f'{A.slug}.png'))//1024, 'KB'); sys.exit(0)
arr=np.array(img).astype(np.int32); al=arr[:,:,3]; r,g,b=arr[:,:,0],arr[:,:,1],arr[:,:,2]
lum=(r*299+g*587+b*114)//1000; sat=np.max(arr[:,:,:3],axis=2)-np.min(arr[:,:,:3],axis=2)
m=(al>128).astype(np.uint8)
m=cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5,5),np.uint8)); m=cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5,5),np.uint8)); m=cv2.medianBlur(m*255, 9)>127
hole=np.zeros_like(m)
if A.hole!='none':
    if A.hole=='green': h=m&(sat>50)&(g>=r-10)&(g>b)&(lum>70)
    else: h=m&(lum>150)&(sat<60)
    h=ndimage.binary_closing(h, iterations=8); h=ndimage.binary_opening(h, iterations=5)
    lab,n=ndimage.label(h)
    if n>=1:
        sizes=ndimage.sum(h,lab,range(1,n+1)); keep=np.argmax(sizes)+1; blob=(lab==keep).astype(np.uint8)
        cnts,_=cv2.findContours(blob, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE); hull=cv2.convexHull(max(cnts,key=cv2.contourArea))
        hole=cv2.fillPoly(np.zeros(m.shape,np.uint8),[hull],1).astype(bool)&m
sil=np.zeros((*m.shape,4),dtype=np.uint8); sil[m]=(17,17,17,255); sil[hole]=(241,241,238,255)
silim=Image.fromarray(sil); mask=Image.fromarray((m*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0)); silim.putalpha(mask)
sw=min(800,silim.width); silim=silim.resize((sw, round(silim.height*sw/silim.width)), Image.LANCZOS); silim.save(os.path.join(A.out, f'{A.slug}-sil.png'), optimize=True); silim.save(os.path.join(A.out, f'{A.slug}-sil.webp'), quality=90, method=6)
a1=onpaper(img).resize((560, round(img.height*560/img.width))); a2=onpaper(silim).resize((560, round(silim.height*560/silim.width)))
sheet=Image.new('RGB',(560*2+30, max(a1.height,a2.height)),'white'); sheet.paste(a1,(0,0)); sheet.paste(a2,(590,0)); sheet.save(os.path.join(A.out, f'sheet-{A.slug}.jpg'), quality=90)
print(A.slug, img.size, silim.size, os.path.getsize(os.path.join(A.out, f'{A.slug}.png'))//1024, 'KB')
