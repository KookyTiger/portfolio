"""Blender (headless) tools for the tiger asset: Tripo download → one clean ~20k-triangle mesh → FBX for Mixamo.
Run from the repo root (source models live in assets/src/, which is not in git):
  B=/Applications/Blender.app/Contents/MacOS/Blender
  $B -b --factory-startup -P merge/tools/tiger_blender.py -- inspect <model> [--json out.json]
  $B -b --factory-startup -P merge/tools/tiger_blender.py -- reduce  <model> <out.fbx> [--tris 20000] [--height-cm 0 = keep]
                                                                  [--maps base|base+normal|all] [--obj-zip out.zip]
  $B -b --factory-startup -P merge/tools/tiger_blender.py -- render  <model> <out-prefix> [--engine EEVEE|WORKBENCH] [--size 1000]
reduce: drops any rig (armature, skin weights, shape keys, animation), joins the meshes, welds vertices a format may split along
UV seams (the seams stay, as per-corner UVs), decimates (collapse) to --tris keeping UVs and materials, smooth-shades, turns the
model to face −Y with the arm span on X, puts the feet on the ground with the origin between them, wires the material maps by
file name (--maps base = base colour only, the Mixamo-safe default: a Mixamo user reports the same "unable to map your existing
skeleton" error went away once metallic and roughness were unwired), and writes a binary FBX in centimetres (UnitScaleFactor 1, Y
up, facing +Z, identity transform — the way Mixamo's own files are) with the textures embedded. --obj-zip also writes the same mesh
as OBJ + MTL + base colour in one flat zip, the safest Mixamo upload (OBJ cannot carry a skeleton or a bind pose). Every map the
source has, wired or not, is kept in <out-dir>/tiger-mixamo-tex/ for the site. A JSON report goes next to the FBX.
render: orthographic front / side (the character's left: face to the left, like the Sketchfab side view) / back / face views,
lit the same way for every model, with a neutral material (base colour + normal map, not metallic) so two versions compare fairly;
writes <out-prefix>-<view>.png and <out-prefix>.json."""
import bpy, bmesh, sys, os, math, json, shutil
import numpy as np
from mathutils import Vector

def parse(a):
    pos, kw, i = [], {}, 0
    while i < len(a):
        if a[i].startswith('--'): kw[a[i][2:]] = a[i + 1]; i += 2
        else: pos.append(a[i]); i += 1
    return pos, kw
POS, KW = parse(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
r3 = lambda v: [round(float(x), 4) for x in v]

def reset(): bpy.ops.wm.read_factory_settings(use_empty=True)
def relink(path):
    """Tripo's FBX stores texture paths from its server (seven '../' up to /workspace/...) and embeds the textures too. Blender's
    recursive image search would walk the whole disk from there (it hung in a blocking folder), so it is off; an image that is
    neither packed nor found is relinked by file name from the model's folder, its .fbm folder or textures/ (no recursion)."""
    base = os.path.dirname(os.path.abspath(path)); dirs = [base, os.path.join(base, 'textures')] + [os.path.join(base, d) for d in os.listdir(base) if d.endswith('.fbm')]
    files = {f.lower(): os.path.join(d, f) for d in dirs if os.path.isdir(d) for f in os.listdir(d)}
    for im in bpy.data.images:
        if im.source != 'FILE' or im.packed_file: continue
        if im.filepath and os.path.exists(bpy.path.abspath(im.filepath)): continue
        hit = files.get(os.path.basename(im.filepath.replace('\\', '/')).lower()) or files.get(im.name.lower())
        if hit: im.filepath = hit; im.reload()
def load(path):
    ext = os.path.splitext(path)[1].lower()
    if ext == '.fbx': bpy.ops.import_scene.fbx(filepath=os.path.abspath(path), use_image_search=False); relink(path)
    elif ext in ('.glb', '.gltf'): bpy.ops.import_scene.gltf(filepath=os.path.abspath(path))
    elif ext == '.obj': bpy.ops.wm.obj_import(filepath=os.path.abspath(path))
    else: sys.exit('unsupported format ' + ext)
    return [o for o in bpy.context.scene.objects if o.type == 'MESH']
def ntris(me): me.calc_loop_triangles(); return len(me.loop_triangles)
def world_verts(objs):                                                  # evaluated (posed) vertices in world space
    dg = bpy.context.evaluated_depsgraph_get(); out = []
    for o in objs:
        oe = o.evaluated_get(dg); me = oe.to_mesh(); co = np.empty(len(me.vertices) * 3, np.float64); me.vertices.foreach_get('co', co)
        M = np.array(oe.matrix_world); co = co.reshape(-1, 3)
        out.append(np.stack([co[:, 0] * M[i, 0] + co[:, 1] * M[i, 1] + co[:, 2] * M[i, 2] + M[i, 3] for i in range(3)], 1)); oe.to_mesh_clear()
    return np.concatenate(out)
def facing(V):
    """Which way the character faces (Z up): in a T-pose the arm span is the widest horizontal extent (left-right); on the other
    horizontal axis the tail reaches further on the back side at hip height."""
    lo, hi = V.min(0), V.max(0); h = hi[2] - lo[2]
    side = 0 if hi[0] - lo[0] >= hi[1] - lo[1] else 1; fb = 1 - side
    band = V[(V[:, 2] > lo[2] + 0.12 * h) & (V[:, 2] < lo[2] + 0.5 * h), fb]
    if len(band) == 0: band = V[:, fb]
    m = np.median(band); plus, minus = band.max() - m, m - band.min()
    front = np.zeros(3); front[fb] = -1.0 if plus > minus else 1.0
    return front, 'XY'[side], float(plus), float(minus)

def stats():
    objs = []
    for o in bpy.context.scene.objects:
        d = {'name': o.name, 'type': o.type, 'parent': o.parent.name if o.parent else None, 'loc': r3(o.location), 'rot_deg': r3([math.degrees(a) for a in o.rotation_euler]), 'scale': r3(o.scale)}
        if o.type == 'MESH':
            me = o.data; co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get('co', co)
            lt = np.empty(len(me.polygons), np.int32); me.polygons.foreach_get('loop_total', lt); sm = np.empty(len(me.polygons), bool); me.polygons.foreach_get('use_smooth', sm)
            d.update(verts=len(me.vertices), unique_positions=int(len(np.unique(np.round(co.reshape(-1, 3), 6), axis=0))), faces=len(me.polygons), tris=ntris(me),
                     quads=int((lt == 4).sum()), ngons=int((lt > 4).sum()),
                     uv_layers=[u.name for u in me.uv_layers], materials=[m.name for m in me.materials if m], vertex_groups=len(o.vertex_groups),
                     shape_keys=len(me.shape_keys.key_blocks) if me.shape_keys else 0, modifiers=[m.type for m in o.modifiers],
                     custom_normals=me.has_custom_normals, color_attributes=[c.name for c in me.color_attributes], smooth_faces=int(sm.sum()))
        elif o.type == 'ARMATURE':
            d.update(bones=len(o.data.bones), first_bones=[b.name for b in o.data.bones][:12], pose_position=o.data.pose_position)
        objs.append(d)
    mats = []
    for m in bpy.data.materials:
        rec = {'name': m.name, 'users': m.users}
        if m.use_nodes:
            rec['textures'] = [f'{n.image.name}:{s.name} -> {l.to_node.type}.{l.to_socket.name}' for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image for s in n.outputs for l in s.links]
            b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
            if b: rec['bsdf'] = {k: [round(float(b.inputs[k].default_value), 3), b.inputs[k].is_linked] for k in ('Metallic', 'Roughness', 'Alpha', 'Specular IOR Level') if k in b.inputs}
        rec['render_method'] = getattr(m, 'surface_render_method', getattr(m, 'blend_method', None)); mats.append(rec)
    imgs = [{'name': i.name, 'size': list(i.size), 'format': i.file_format, 'path': i.filepath, 'packed': bool(i.packed_file), 'colorspace': i.colorspace_settings.name, 'users': i.users} for i in bpy.data.images]
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    V = world_verts(meshes); lo, hi = V.min(0), V.max(0); front, side, plus, minus = facing(V)
    us = bpy.context.scene.unit_settings
    return {'objects': objs, 'materials': mats, 'images': imgs, 'actions': [(a.name, r3(a.frame_range)) for a in bpy.data.actions],
            'tris_total': sum(ntris(o.data) for o in meshes), 'bbox_min': r3(lo), 'bbox_max': r3(hi), 'size': r3(hi - lo),
            'front': r3(front), 'arm_span_axis': side, 'tail_reach_back_vs_front': [round(max(plus, minus), 3), round(min(plus, minus), 3)],
            'units': [us.system, us.scale_length, us.length_unit]}

# ── material: wire Tripo's maps by file name ──
ROLE_KEYS = (('basecolor', ('basecolor', 'base_color', 'albedo')), ('normal', ('normal',)), ('roughness', ('rough',)), ('metallic', ('metal',)), ('rm', ('_rm.', '_orm.')))
IMG_EXT = ('.png', '.jpg', '.jpeg', '.webp', '.tga', '.tif', '.tiff')
def role_of(im):
    key = os.path.basename(im.filepath.replace('\\', '/')).lower() or im.name.lower()
    return next((r for r, ks in ROLE_KEYS if any(k in key for k in ks)), None)
def linked_image(sock):
    n = sock.links[0].from_node if sock.links else None
    while n is not None and n.type != 'TEX_IMAGE':
        src = next((s for s in n.inputs if s.links), None); n = src.links[0].from_node if src else None
    return n.image if n else None
def tidy_material(ob, texdir, src, maps='base'):
    """Wire the maps by what their file names say and write every map the source has to texdir under a clean name (tiger_<role>),
    the names the exports embed or reference (Tripo's FBX paths point at its server). In Blender, Tripo's FBX material reads as
    metallic 1.0 with the roughness map on Specular IOR Level and the base colour's alpha on Alpha (all opaque); its OBJ material
    has the base colour only. maps: 'base' wires the base colour only (Mixamo-safe), 'base+normal' adds the normal map, 'all' adds
    roughness and metallic. Nothing goes on Alpha or Specular."""
    mat = ob.data.materials[0]; nt = mat.node_tree; b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    imgs = {}; bc = linked_image(b.inputs['Base Color']); nm = linked_image(b.inputs['Normal'])
    if bc: imgs['basecolor'] = bc
    if nm: imgs['normal'] = nm
    for im in bpy.data.images:
        r = role_of(im)
        if r and r not in imgs and r != 'basecolor': imgs[r] = im
    os.makedirs(texdir, exist_ok=True)
    for f in os.listdir(texdir):                                                # this folder is generated: start clean
        if f.startswith('tiger_'): os.remove(os.path.join(texdir, f))
    kept = {}
    for r, im in imgs.items():
        srcp = bpy.path.abspath(im.filepath); ext = os.path.splitext(srcp)[1].lower() if os.path.splitext(srcp)[1].lower() in IMG_EXT else ('.jpg' if im.file_format == 'JPEG' else '.png')
        path = os.path.join(texdir, f'tiger_{r}{ext}')
        if im.packed_file: open(path, 'wb').write(im.packed_file.data)
        else: shutil.copyfile(srcp, path)
        im.name = f'tiger_{r}'; im.filepath = path; kept[r] = [os.path.basename(path), list(im.size)]
    base = os.path.dirname(os.path.abspath(src))                                # maps the source ships but its material does not use (the OBJ's normal and _rm)
    for f in sorted(os.listdir(base)):
        r = role_of(type('I', (), {'filepath': f, 'name': f})()); ext = os.path.splitext(f)[1].lower()
        if r and r not in kept and ext in IMG_EXT: shutil.copyfile(os.path.join(base, f), os.path.join(texdir, f'tiger_{r}{ext}')); kept[r] = [f'tiger_{r}{ext}', 'unwired, from the source folder']
    for sock in ('Alpha', 'Specular IOR Level', 'Metallic', 'Roughness'):
        for l in list(b.inputs[sock].links): nt.links.remove(l)
    b.inputs['Alpha'].default_value = 1.0; b.inputs['Specular IOR Level'].default_value = 0.5; b.inputs['Metallic'].default_value = 0.0; b.inputs['Roughness'].default_value = 0.8
    if maps == 'base':
        for l in list(b.inputs['Normal'].links): nt.links.remove(l)
    def tex_node(im):
        n = next((n for n in nt.nodes if n.type == 'TEX_IMAGE' and n.image == im), None) or nt.nodes.new('ShaderNodeTexImage')
        n.image = im; im.colorspace_settings.name = 'Non-Color'; return n
    if maps == 'all':
        if 'roughness' in imgs: nt.links.new(tex_node(imgs['roughness']).outputs['Color'], b.inputs['Roughness'])
        if 'metallic' in imgs: nt.links.new(tex_node(imgs['metallic']).outputs['Color'], b.inputs['Metallic'])
    for n in list(nt.nodes):                                                    # nodes that now feed nothing
        if n.type in ('TEX_IMAGE', 'NORMAL_MAP') and not any(s.links for s in n.outputs): nt.nodes.remove(n)
    mat.name = 'tiger'
    return kept
def neutral_materials():                                                        # render only: base colour + normal map, not metallic
    for m in bpy.data.materials:
        b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if m.use_nodes else None
        if not b: continue
        for sock, v in (('Alpha', 1.0), ('Metallic', 0.0), ('Roughness', 0.8), ('Specular IOR Level', 0.5)):
            for l in list(b.inputs[sock].links): m.node_tree.links.remove(l)
            b.inputs[sock].default_value = v

# ── render ──
def engine(name):
    sc = bpy.context.scene
    if name == 'WORKBENCH':
        sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'TEXTURE'; return sc.render.engine
    for e in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
        try: sc.render.engine = e; break
        except TypeError: continue
    try: sc.eevee.taa_render_samples = 48
    except AttributeError: pass
    return sc.render.engine
def light_rig(front):
    sc = bpy.context.scene; w = bpy.data.worlds.new('studio'); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes['Background']; bg.inputs[0].default_value = (0.80, 0.78, 0.76, 1.0); bg.inputs[1].default_value = 0.9
    up = Vector((0, 0, 1)); F = Vector(front); Lf = up.cross(F)
    for name, frm, e in (('key', F * 1.0 + up * 1.3 + Lf * 0.7, 2.2), ('rim', -F * 1.0 + up * 0.8 - Lf * 0.8, 1.0)):
        L = bpy.data.lights.new(name, 'SUN'); L.energy = e; L.angle = math.radians(20)
        ob = bpy.data.objects.new(name, L); sc.collection.objects.link(ob); ob.rotation_euler = (-frm.normalized()).to_track_quat('-Z', 'Y').to_euler()
def render(src, prefix, eng='EEVEE', size=1000):
    reset(); meshes = load(src); st = stats(); sc = bpy.context.scene; st['engine'] = engine(eng); neutral_materials()
    sc.render.resolution_x = sc.render.resolution_y = size; sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'; sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
    V = world_verts(meshes); lo, hi = V.min(0), V.max(0); c = Vector(((lo + hi) / 2).tolist()); ext = hi - lo; h = float(ext[2]); big = float(ext.max())
    F = Vector(st['front']); up = Vector((0, 0, 1)); Lf = up.cross(F)                  # Lf = the character's left
    light_rig(F)
    cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.clip_start = 0.001 * big; cd.clip_end = 100 * big
    cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
    for name, d, tgt, scale in (('front', F, c, 1.08 * big), ('side', Lf, c, 1.08 * big), ('back', -F, c, 1.08 * big), ('face', F, Vector((c.x, c.y, lo[2] + 0.76 * h)), 0.56 * h)):
        cd.ortho_scale = scale; cam.location = tgt + d * (3 * big); cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.abspath(f'{prefix}-{name}.png'); bpy.ops.render.render(write_still=True)
    with open(os.path.abspath(prefix + '.json'), 'w') as f: json.dump(st, f, indent=1)
    print('RENDERED', prefix, st['engine'], 'tris', st['tris_total'], 'size', st['size'], 'front', st['front'])

# ── reduce ──
def reduce(src, out, target=20000, height_cm=0.0, maps='base', obj_zip=None):
    reset(); load(src); before = stats(); sc = bpy.context.scene; vl = bpy.context.view_layer
    meshes = [o for o in sc.objects if o.type == 'MESH']
    removed = {'armatures': [o.name for o in sc.objects if o.type == 'ARMATURE'], 'other_objects': [o.name for o in sc.objects if o.type not in ('MESH', 'ARMATURE')],
               'vertex_groups': 0, 'shape_keys': 0, 'armature_modifiers': 0, 'actions': len(bpy.data.actions)}
    for o in meshes:                                                            # 1. drop any rig; the mesh keeps its bind (T) pose
        mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
        for m in list(o.modifiers):
            if m.type == 'ARMATURE': o.modifiers.remove(m); removed['armature_modifiers'] += 1
        removed['vertex_groups'] += len(o.vertex_groups); o.vertex_groups.clear()
        if o.data.shape_keys: removed['shape_keys'] += len(o.data.shape_keys.key_blocks); o.shape_key_clear()
        o.animation_data_clear()
    for o in list(sc.objects):
        if o.type != 'MESH': bpy.data.objects.remove(o, do_unlink=True)
    for a in list(bpy.data.actions): bpy.data.actions.remove(a)
    for a in list(bpy.data.armatures): bpy.data.armatures.remove(a)
    for o in sc.objects: o.select_set(o in meshes)
    vl.objects.active = meshes[0]
    if len(meshes) > 1: bpy.ops.object.join()                                   # 2. one mesh, transforms applied
    ob = vl.objects.active; ob.name = 'tiger'; ob.data.name = 'tiger'
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if ob.data.has_custom_normals: bpy.ops.mesh.customdata_custom_splitnormals_clear()
    me = ob.data; v0 = len(me.vertices)                                         # 3. weld seam splits, if any (UVs stay per corner)
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5 * max(ob.dimensions)); bm.to_mesh(me); bm.free(); me.update()
    welded = v0 - len(me.vertices); t0 = ntris(me); passes = []
    for _ in range(4):                                                          # 4. decimate (collapse); UV seams are kept as boundaries
        t = ntris(ob.data)
        if t <= target * 1.02: break
        md = ob.modifiers.new('decimate', 'DECIMATE'); md.decimate_type = 'COLLAPSE'; md.ratio = target / t; md.use_collapse_triangulate = True
        with bpy.context.temp_override(object=ob, active_object=ob): bpy.ops.object.modifier_apply(modifier=md.name)
        passes.append([t, ntris(ob.data)])
        if passes[-1][1] >= t: break
    me = ob.data
    try: me.shade_smooth()
    except AttributeError: me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    V = world_verts([ob]); front, side_axis, plus, minus = facing(V)             # 5. face −Y (→ +Z in the FBX), arm span on X
    ang = math.atan2(-1.0, 0.0) - math.atan2(front[1], front[0])
    ob.rotation_euler = (0, 0, ang); bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    V = world_verts([ob]); lo, hi = V.min(0), V.max(0); h_m = float(hi[2] - lo[2])   # 6. centimetres; feet on z = 0, origin between the feet
    H = height_cm if height_cm > 0 else round(h_m * 100, 2); s = H / h_m
    feet = V[V[:, 2] < lo[2] + 0.08 * h_m]; fc = (feet.min(0) + feet.max(0)) / 2
    ob.scale = (s, s, s); ob.location = (-fc[0] * s, -fc[1] * s, -lo[2] * s); bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)
    us = sc.unit_settings; us.system = 'METRIC'; us.scale_length = 0.01; us.length_unit = 'CENTIMETERS'
    kept = tidy_material(ob, os.path.join(os.path.dirname(os.path.abspath(out)), 'tiger-mixamo-tex'), src, maps)   # 7. material
    bpy.data.orphans_purge(do_recursive=True)
    for o in sc.objects: o.select_set(o == ob)
    vl.objects.active = ob
    bpy.ops.export_scene.fbx(filepath=os.path.abspath(out), use_selection=True, object_types={'MESH'}, use_mesh_modifiers=True, mesh_smooth_type='FACE',
        use_tspace=False, apply_unit_scale=True, apply_scale_options='FBX_SCALE_ALL', axis_forward='-Z', axis_up='Y', bake_space_transform=True,
        add_leaf_bones=False, bake_anim=False, path_mode='COPY', embed_textures=True)
    zipped = None
    if obj_zip:                                                                 # 8. the same mesh as OBJ + MTL + base colour, one flat zip
        import zipfile
        stage = os.path.splitext(os.path.abspath(obj_zip))[0] + '-obj'; os.makedirs(stage, exist_ok=True)
        for f in os.listdir(stage): os.remove(os.path.join(stage, f))
        bpy.ops.wm.obj_export(filepath=os.path.join(stage, 'tiger.obj'), export_selected_objects=True, export_uv=True, export_normals=True, export_materials=True,
            export_pbr_extensions=False, path_mode='COPY', forward_axis='NEGATIVE_Z', up_axis='Y', global_scale=1.0, apply_modifiers=True, export_triangulated_mesh=True)
        tex = next((f for f in os.listdir(stage) if f.startswith('tiger_basecolor')), None)   # Blender's MTL omits Kd when a texture is linked and writes Ka 1 1 1;
        with open(os.path.join(stage, 'tiger.mtl'), 'w') as f:                  # some viewers then show it black or washed out, so write Tripo's minimal form
            f.write('newmtl tiger\nKd 1.000000 1.000000 1.000000\nd 1.000000\nillum 2\n' + (f'map_Kd {tex}\n' if tex else ''))
        with zipfile.ZipFile(os.path.abspath(obj_zip), 'w', zipfile.ZIP_DEFLATED) as z:
            for f in sorted(os.listdir(stage)): z.write(os.path.join(stage, f), f)
        zipped = {'zip': obj_zip, 'bytes': os.path.getsize(obj_zip), 'files': {f: os.path.getsize(os.path.join(stage, f)) for f in sorted(os.listdir(stage))},
                  'mtl': open(os.path.join(stage, 'tiger.mtl')).read()}
    after = stats()
    rep = {'source': src, 'out': out, 'bytes': os.path.getsize(out), 'removed': removed, 'welded_vertices': welded, 'tris_before_decimate': t0,
           'decimate_passes': passes, 'rotation_applied_deg': round(math.degrees(ang), 1), 'height_cm': H, 'scale_applied': round(s, 5), 'maps_wired': maps, 'maps_kept': kept, 'obj_zip': zipped,
           'before': before, 'after': after}
    with open(os.path.splitext(os.path.abspath(out))[0] + '-report.json', 'w') as f: json.dump(rep, f, indent=1)
    print('REDUCED', json.dumps({k: rep[k] for k in ('bytes', 'removed', 'welded_vertices', 'tris_before_decimate', 'decimate_passes', 'rotation_applied_deg', 'height_cm', 'maps_wired', 'maps_kept', 'obj_zip')}))
    print('AFTER', json.dumps({k: after[k] for k in ('tris_total', 'size', 'bbox_min', 'front', 'arm_span_axis', 'units')}), json.dumps(after['materials']))

mode = POS[0] if POS else 'inspect'
if mode == 'inspect':
    reset(); load(POS[1]); st = stats(); txt = json.dumps(st, indent=1)
    if 'json' in KW: open(KW['json'], 'w').write(txt)
    print('INSPECT', txt)
elif mode == 'render': render(POS[1], POS[2], KW.get('engine', 'EEVEE'), int(KW.get('size', 1000)))
elif mode == 'reduce': reduce(POS[1], POS[2], int(KW.get('tris', 20000)), float(KW.get('height-cm', 0)), KW.get('maps', 'base'), KW.get('obj-zip'))
else: sys.exit('unknown mode ' + mode)
