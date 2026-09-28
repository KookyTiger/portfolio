// The tiger GLB's texture, in and out, without touching the rig or the clips.
//   node merge/tools/tiger_tex.mjs extract assets/tiger/tiger.glb <dir>          → <dir>/<texture>.webp + <dir>/mesh.json (bind-pose POSITION, NORMAL,
//                                                                                   TEXCOORD_0, JOINTS_0, WEIGHTS_0, indices, joint names) for tiger_paint.py
//   node merge/tools/tiger_tex.mjs swap assets/tiger/tiger.glb painted.png out.glb [--size 1024] [--quality 88]
//                                                                                 → out.glb with the base colour image replaced (webp), everything else as is
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const [cmd, glb, a, b, ...rest] = process.argv.slice(2);
const opt = (k, d) => { const i = rest.indexOf('--' + k); return i >= 0 ? rest[i + 1] : d; };
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(glb);
const root = doc.getRoot();
const baseTex = () => { const m = root.listMaterials()[0]; const t = m && m.getBaseColorTexture(); if (!t) throw new Error('no base colour texture'); return t; };

if (cmd === 'extract') {
  fs.mkdirSync(a, { recursive: true });
  const t = baseTex(); const ext = (t.getMimeType() || 'image/png').split('/')[1];
  fs.writeFileSync(path.join(a, (t.getName() || 'basecolor') + '.' + ext), t.getImage());
  const prim = root.listMeshes()[0].listPrimitives()[0], out = {};
  for (const n of ['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0']) { const acc = prim.getAttribute(n); out[n] = { size: acc.getElementSize(), array: Array.from(acc.getArray()) }; }
  out.indices = Array.from(prim.getIndices().getArray());
  out.joints = root.listSkins()[0].listJoints().map((j) => j.getName());
  fs.writeFileSync(path.join(a, 'mesh.json'), JSON.stringify(out));
  console.log('extracted', t.getName(), t.getMimeType(), 'verts', out.POSITION.array.length / 3, 'tris', out.indices.length / 3);
} else if (cmd === 'swap') {
  const size = +opt('size', 1024), quality = +opt('quality', 88);
  const img = await sharp(a).resize(size, size, { kernel: 'lanczos3' }).webp({ quality }).toBuffer();
  const t = baseTex(); t.setImage(new Uint8Array(img)).setMimeType('image/webp');
  await io.write(b, doc);
  console.log('swapped', t.getName(), size + 'px webp', (img.length / 1024).toFixed(1) + ' KB', '→', b, (fs.statSync(b).size / 1024 / 1024).toFixed(2) + ' MB');
} else {
  console.log('usage: extract <glb> <dir> | swap <glb> <image> <out.glb> [--size 1024] [--quality 88]'); process.exit(1);
}
