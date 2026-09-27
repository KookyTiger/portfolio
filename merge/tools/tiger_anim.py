"""Blender (headless) tools for the Mixamo tiger: survey the downloaded clips, then build the site's GLB.
Run from the repo root:
  B=/Applications/Blender.app/Contents/MacOS/Blender
  $B -b --factory-startup -P merge/tools/tiger_anim.py -- survey <skin.fbx> <out-dir> <clip.fbx> [<clip.fbx> ...]
  $B -b --factory-startup -P merge/tools/tiger_anim.py -- analyze <skin.fbx> <out.json> <clip.fbx> [...]
  $B -b --factory-startup -P merge/tools/tiger_anim.py -- build <skin.fbx> <clip-dir> <out.glb> [--check <dir>]
survey: loads the skinned T-pose tiger once, applies every clip's action to it, measures the clip (length, root motion) and renders
6 frames of it (Workbench, camera following the hips) to <out-dir>/<n>-<k>.png, plus <out-dir>/survey.json.
analyze: facing, ground contact and (for Climbing Ladder) the hand and foot grip heights of the chosen clips.
build: the skinned tiger + one action per site state (CLIPS below, named after the state), skin weights cleaned (fix_weights), exported
as one GLB with an animation per state. --check renders the same poses before and after the weight fix (chin, belly)."""
import bpy, sys, os, math, json
import numpy as np
from mathutils import Vector

def parse(a):
    pos, kw, i = [], {}, 0
    while i < len(a):
        if a[i].startswith('--'): kw[a[i][2:]] = a[i + 1]; i += 2
        else: pos.append(a[i]); i += 1
    return pos, kw
POS, KW = parse(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
FPS = 30

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene; sc.render.fps = FPS; sc.render.fps_base = 1.0
def import_fbx(path):
    before = set(bpy.data.objects); acts0 = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=os.path.abspath(path), use_image_search=False, ignore_leaf_bones=True, automatic_bone_orientation=False)
    return [o for o in bpy.data.objects if o not in before], [a for a in bpy.data.actions if a not in acts0]
def assign(arm, act):
    ad = arm.animation_data or arm.animation_data_create(); ad.action = act
    if hasattr(ad, 'action_slot') and ad.action_slot is None and getattr(act, 'slots', None):
        try: ad.action_slot = act.slots[0]
        except Exception: pass
def bone(arm, key):
    return next((p for p in arm.pose.bones if p.name.split(':')[-1] == key), None)

def survey(skin, outdir, clips):
    reset(); objs, _ = import_fbx(skin); sc = bpy.context.scene
    arm = next(o for o in objs if o.type == 'ARMATURE'); meshes = [o for o in objs if o.type == 'MESH']
    for a in list(bpy.data.actions): bpy.data.actions.remove(a)
    hips = bone(arm, 'Hips'); head = bone(arm, 'Head')
    info = {'skin': skin, 'armature': arm.name, 'bones': len(arm.data.bones), 'bone_names': [b.name for b in arm.data.bones],
            'arm_rot_deg': [round(math.degrees(v), 1) for v in arm.rotation_euler], 'arm_scale': [round(v, 4) for v in arm.scale],
            'meshes': [(m.name, len(m.data.vertices), len(m.data.polygons)) for m in meshes], 'clips': []}
    sc.frame_set(0); bpy.context.view_layer.update()
    rest_head = arm.matrix_world @ head.head; rest_hips = arm.matrix_world @ hips.head
    info['rest'] = {'hips': [round(v, 4) for v in rest_hips], 'head': [round(v, 4) for v in rest_head]}
    # renderer: Workbench, textured, orthographic 3/4 view that follows the hips
    sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'TEXTURE'
    sc.render.resolution_x = sc.render.resolution_y = 300; sc.render.image_settings.file_format = 'PNG'
    w = bpy.data.worlds.new('w'); sc.world = w; w.color = (0.86, 0.85, 0.83)
    cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
    H = rest_head.z * 1.55; cd.ortho_scale = H * 1.55; cd.clip_start = 0.01; cd.clip_end = 100
    view = Vector((0.55, -1.0, 0.35)).normalized()                             # 3/4 front (the tiger faces −Y), a little from above
    os.makedirs(outdir, exist_ok=True)
    for n, path in enumerate(clips):
        objs2, acts = import_fbx(path)
        act = next((a for a in acts if any('Hips' in fc.data_path for fc in a.fcurves)), acts[0] if acts else None)
        for o in objs2: bpy.data.objects.remove(o, do_unlink=True)
        if act is None: info['clips'].append({'n': n, 'file': path, 'error': 'no action'}); continue
        act.use_fake_user = True; assign(arm, act)
        f0, f1 = [int(round(v)) for v in act.frame_range]; frames = list(range(f0, f1 + 1))
        P = []
        for f in frames:
            sc.frame_set(f); P.append(list(arm.matrix_world @ hips.head))
        P = np.array(P); d = P[-1] - P[0]
        rec = {'n': n, 'file': os.path.basename(path), 'action': act.name, 'frames': [f0, f1], 'seconds': round((f1 - f0) / FPS, 2),
               'hips_start': [round(v, 3) for v in P[0]], 'hips_net_move': [round(v, 3) for v in d], 'hips_range': [round(v, 3) for v in (P.max(0) - P.min(0))]}
        for k, fr in enumerate(np.linspace(f0, f1, 6).round().astype(int)):
            sc.frame_set(int(fr)); c = arm.matrix_world @ hips.head; tgt = Vector((c.x, c.y, c.z + H * 0.12))
            cam.location = tgt + view * 8; cam.rotation_euler = (-view).to_track_quat('-Z', 'Y').to_euler()
            sc.render.filepath = os.path.abspath(os.path.join(outdir, f'{n:02d}-{k}.png')); bpy.ops.render.render(write_still=True)
        info['clips'].append(rec); print('CLIP', json.dumps(rec))
    with open(os.path.join(outdir, 'survey.json'), 'w') as f: json.dump(info, f, indent=1)
    print('SURVEY', json.dumps({k: info[k] for k in ('armature', 'bones', 'arm_rot_deg', 'arm_scale', 'meshes', 'rest')}))

def analyze(skin, clips, out):
    """Per clip: hips path and facing over time, the lowest mesh point relative to the hips (for ground contact), and for a ladder
    climb the grip phases of each hand and foot (world height and depth while the limb is still)."""
    reset(); objs, _ = import_fbx(skin); sc = bpy.context.scene
    arm = next(o for o in objs if o.type == 'ARMATURE'); mesh = next(o for o in objs if o.type == 'MESH')
    for a in list(bpy.data.actions): bpy.data.actions.remove(a)
    B = {k: bone(arm, k) for k in ('Hips', 'Head', 'LeftHand', 'RightHand', 'LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase')}
    res = {}
    for path in clips:
        objs2, acts = import_fbx(path); act = next((a for a in acts if any('Hips' in fc.data_path for fc in a.fcurves)), acts[0])
        for o in objs2: bpy.data.objects.remove(o, do_unlink=True)
        act.use_fake_user = True; assign(arm, act); f0, f1 = [int(round(v)) for v in act.frame_range]
        rows = []
        for f in range(f0, f1 + 1):
            sc.frame_set(f); M = arm.matrix_world
            r = {k: list(M @ b.head) for k, b in B.items()}
            fwd = (M.to_3x3() @ (B['Hips'].matrix.to_3x3() @ Vector((0, 0, 1)))); r['yaw'] = math.degrees(math.atan2(fwd.x, -fwd.y))   # 0 = facing −Y (the camera)
            if (f - f0) % 3 == 0:
                dg = bpy.context.evaluated_depsgraph_get(); me = mesh.evaluated_get(dg).to_mesh(); co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get('co', co)
                co = co.reshape(-1, 3) @ np.array(mesh.matrix_world)[:3, :3].T + np.array(mesh.matrix_world)[:3, 3]; r['low'] = float(co[:, 2].min()); r['top'] = float(co[:, 2].max()); mesh.evaluated_get(dg).to_mesh_clear()
            rows.append(r)
        name = os.path.splitext(os.path.basename(path))[0]; H = np.array([r['Hips'] for r in rows])
        rec = {'frames': [f0, f1], 'hips_z': [round(float(H[:, 2].min()), 3), round(float(H[:, 2].max()), 3)], 'yaw_start_end': [round(rows[0]['yaw']), round(rows[-1]['yaw'])],
               'yaw_samples': [round(rows[i]['yaw']) for i in np.linspace(0, len(rows) - 1, 9).astype(int)],
               'low_minus_hips': [round(r['low'] - r['Hips'][2], 3) for r in rows if 'low' in r][::max(1, len(rows) // 24)],
               'top_minus_hips': round(max(r['top'] - r['Hips'][2] for r in rows if 'top' in r), 3)}
        if 'Climbing Ladder' == name:
            grips = {}
            for k in ('LeftHand', 'RightHand', 'LeftToeBase', 'RightToeBase'):
                P = np.array([r[k] for r in rows]); V = np.linalg.norm(np.diff(P, axis=0), axis=1) * FPS; still = V < 0.05
                seg, cur = [], None
                for i, st in enumerate(still):
                    if st and cur is None: cur = i
                    if (not st or i == len(still) - 1) and cur is not None: seg.append((cur, i)); cur = None
                grips[k] = [{'frames': [int(a + f0), int(b + f0)], 'z': round(float(P[a:b + 1, 2].mean()), 4), 'y': round(float(P[a:b + 1, 1].mean()), 4), 'x': round(float(P[a:b + 1, 0].mean()), 4)} for a, b in seg if b - a >= 2]
                grips[k + '_speed'] = [round(float(v), 3) for v in V[::2]]
            rec['grips'] = grips; rec['hips_path_z'] = [round(float(z), 4) for z in H[:, 2]]; rec['hips_y'] = round(float(H[:, 1].mean()), 4)
        res[name] = rec; print('ANALYZE', name, json.dumps({k: v for k, v in rec.items() if k not in ('grips', 'hips_path_z')}))
    with open(out, 'w') as f: json.dump(res, f, indent=1)

# ── build ──
CLIPS = [('idle', 'Happy Idle.fbx'), ('turn', 'Quick 180 Turn.fbx'), ('mount', 'Start Climbing Ladder.fbx'), ('climb', 'Climbing Ladder.fbx'),
         ('sit', 'Sitting.fbx'), ('wave', 'Waving.fbx'),
         # the meadow's talent show (Kay, 2026-09-27): dance, zombie (idle → scream → attack), catwalk (one wide 180° walk, played there and back)
         ('dance', 'Wave Hip Hop Dance.fbx'), ('zidle', '_packs/Scary Zombie Pack/zombie idle.fbx'), ('zscream', '_packs/Scary Zombie Pack/zombie scream.fbx'),
         ('zattack', '_packs/Scary Zombie Pack/zombie attack.fbx'), ('catwalk', 'Catwalk Walk Turn 180 Wide L.fbx')]
def fix_weights(arm, mesh):
    """Mixamo weights a human; this tiger has no neck (the jaw is level with the shoulders), a round belly and a tail. Rest pose, world
    metres, facing −Y: the whole head (above the chin joint) follows the Head bone only, with a short blend band down to the neck;
    the belly (between the hips and the armpits) loses every arm and leg influence; the tail rides the hips."""
    M = arm.matrix_world; J = {b.name.split(':')[-1]: M @ b.head_local for b in arm.data.bones}
    vg = {g.name.split(':')[-1]: g.index for g in mesh.vertex_groups}; n = len(mesh.data.vertices); G = len(mesh.vertex_groups)
    W = np.zeros((n, G))
    for v in mesh.data.vertices:
        for g in v.groups: W[v.index, g.group] = g.weight
    co = np.array([list(mesh.matrix_world @ v.co) for v in mesh.data.vertices]); x, y, z = co[:, 0], co[:, 1], co[:, 2]
    idx = lambda names: [vg[k] for k in names if k in vg]
    ARM = idx([f'{s}{b}' for s in ('Left', 'Right') for b in ('Shoulder', 'Arm', 'ForeArm', 'Hand', 'HandIndex1', 'HandIndex2', 'HandIndex3')])
    LEG = idx([f'{s}{b}' for s in ('Left', 'Right') for b in ('UpLeg', 'Leg', 'Foot', 'ToeBase')])
    zHead = J['Head'].z; zHip = (J['LeftUpLeg'].z + J['RightUpLeg'].z) / 2; zArmLow = float(z[np.abs(x) > 0.26].min()); H = float(z.max() - z.min())
    head = np.zeros(G); head[vg['Head']] = 1; hips = np.zeros(G); hips[vg['Hips']] = 1; spine1 = np.zeros(G); spine1[vg['Spine1']] = 1
    def renorm(rows, fallback):
        s = W[rows].sum(1, keepdims=True); bad = (s[:, 0] < 1e-6); W[rows] = np.where(s > 1e-6, W[rows] / np.maximum(s, 1e-6), 0); W[np.array(rows)[bad]] = fallback
    ss = lambda a, b, v: np.clip((v - a) / (b - a), 0, 1) ** 2 * (3 - 2 * np.clip((v - a) / (b - a), 0, 1))
    ax = np.abs(x); xs = abs(J['LeftArm'].x)
    # soft masks (1 = fix fully, 0 = leave Mixamo's weights): hard cuts tore the shoulders, so every region fades out toward the arms
    m_band = (z >= zHead - 0.035) & (z < zHead + 0.012) & (ax < xs - 0.02)                        # under the chin: the neck column only
    f_band = 1 - ss(xs - 0.07, xs - 0.02, ax)
    m_belly = (z > zHip + 0.02) & (z < zArmLow - 0.015) & (ax < xs + 0.03) & (y < 0.13)            # belly and flanks below the armpits
    f_belly = (1 - ss(xs - 0.06, xs + 0.03, ax)) * (1 - ss(zArmLow - 0.09, zArmLow - 0.015, z))
    r_head = (z >= zHead + 0.012) & (ax < 0.26) & ~((ax > xs - 0.02) & (z < zHead + 0.05))          # the head, not the shoulder caps
    r_tail = (y >= 0.13) & (z < zArmLow)
    stats = {'joints_z': {k: round(J[k].z, 3) for k in ('Hips', 'LeftUpLeg', 'Spine2', 'Neck', 'Head', 'LeftArm')}, 'x_shoulder': round(xs, 3), 'z_arm_low': round(zArmLow, 3), 'height': round(H, 3),
             'head': int(r_head.sum()), 'band': int(m_band.sum()), 'belly': int(m_belly.sum()), 'tail': int(r_tail.sum()),
             'arm_weight_on_belly_before': round(float(W[m_belly][:, ARM].sum(1).mean()), 3), 'non_head_weight_on_head_before': round(float(1 - W[r_head][:, vg['Head']].mean()), 3)}
    W[r_head] = head
    b = np.where(m_band)[0]; W[np.ix_(b, ARM)] *= (1 - f_band[b])[:, None]; renorm(b, spine1)
    t = np.clip((z[b] - (zHead - 0.035)) / 0.047, 0, 1); t = t * t * (3 - 2 * t) * f_band[b]; W[b] = W[b] * (1 - t[:, None]) + head[None] * t[:, None]
    b = np.where(m_belly)[0]; W[np.ix_(b, ARM)] *= (1 - f_belly[b])[:, None]; hi = b[z[b] > zHip + 0.04]; W[np.ix_(hi, LEG)] *= (1 - f_belly[hi])[:, None]; renorm(b, spine1)
    stats['arm_weight_on_belly_after'] = round(float(W[m_belly][:, ARM].sum(1).mean()), 3)
    b = np.where(r_tail)[0]; W[np.ix_(b, ARM + LEG)] = 0; renorm(b, hips)
    for gi, g in enumerate(mesh.vertex_groups):                                 # write back (4 strongest influences, normalised)
        g.remove(list(range(n)))
    top = np.argsort(-W, axis=1)[:, :4]; tw = np.take_along_axis(W, top, 1); tw = tw / np.maximum(tw.sum(1, keepdims=True), 1e-6)
    groups = list(mesh.vertex_groups)
    for i in range(n):
        for k in range(4):
            if tw[i, k] > 1e-4: groups[top[i, k]].add([i], float(tw[i, k]), 'REPLACE')
    return stats
def gltf_export(path, **kw):
    while True:
        try: return bpy.ops.export_scene.gltf(filepath=path, **kw)
        except TypeError as e:
            bad = str(e).split('"')[1] if '"' in str(e) else None
            if not bad or bad not in kw: raise
            print('drop unsupported glTF option', bad); kw.pop(bad)
def check_render(arm, outdir, tag, poses):
    sc = bpy.context.scene; sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'TEXTURE'
    sc.render.resolution_x = sc.render.resolution_y = 360; sc.world = sc.world or bpy.data.worlds.new('w'); sc.world.color = (0.86, 0.85, 0.83)
    cam = sc.camera or bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    if cam.name not in sc.collection.objects: sc.collection.objects.link(cam)
    sc.camera = cam; cam.data.type = 'ORTHO'; cam.data.ortho_scale = 0.62; os.makedirs(outdir, exist_ok=True)
    for k, (act, frame, view) in enumerate(poses):
        assign(arm, bpy.data.actions[act]); sc.frame_set(frame); c = arm.matrix_world @ bone(arm, 'Neck').head
        d = Vector(view).normalized(); cam.location = Vector((c.x, c.y, c.z - 0.06)) + d * 5; cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.abspath(f'{outdir}/{tag}-{k}.png'); bpy.ops.render.render(write_still=True)
def build(skin, clipdir, out, check=None):
    reset(); objs, _ = import_fbx(skin); sc = bpy.context.scene
    arm = next(o for o in objs if o.type == 'ARMATURE'); mesh = next(o for o in objs if o.type == 'MESH')
    for a in list(bpy.data.actions): bpy.data.actions.remove(a)
    for name, f in CLIPS:
        o2, acts = import_fbx(os.path.join(clipdir, f)); act = next((a for a in acts if any('Hips' in fc.data_path for fc in a.fcurves)), acts[0])
        for o in o2: bpy.data.objects.remove(o, do_unlink=True)
        for a in acts:
            if a is not act: bpy.data.actions.remove(a)
        act.name = name; act.use_fake_user = True
    poses = [('idle', 30, (0.2, -1, 0.1)), ('turn', 20, (0.2, -1, 0.1)), ('sit', 100, (0.9, -1, 0.15)), ('climb', 12, (0.5, 1, 0.1)), ('mount', 35, (1, -0.3, 0.1)), ('wave', 8, (0.2, -1, 0.1))]
    if check: check_render(arm, check, 'before', poses)
    st = fix_weights(arm, mesh); print('WEIGHTS', json.dumps(st))
    if check: check_render(arm, check, 'after', poses)
    for m in bpy.data.materials:                                                 # a plain, non-metallic fur material
        b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if m.use_nodes else None
        if not b: continue
        for sock, v in (('Metallic', 0.0), ('Roughness', 0.85), ('Alpha', 1.0), ('Specular IOR Level', 0.3)):
            for l in list(b.inputs[sock].links): m.node_tree.links.remove(l)
            b.inputs[sock].default_value = v
    ad = arm.animation_data or arm.animation_data_create(); ad.action = None
    for name, _ in CLIPS:
        act = bpy.data.actions[name]; tr = ad.nla_tracks.new(); tr.name = name
        stp = tr.strips.new(name, int(act.frame_range[0]), act)
        if hasattr(stp, 'action_slot') and getattr(act, 'slots', None) and stp.action_slot is None:
            try: stp.action_slot = act.slots[0]
            except Exception: pass
    for o in sc.objects: o.select_set(o in (arm, mesh))
    bpy.context.view_layer.objects.active = arm
    gltf_export(os.path.abspath(out), export_format='GLB', use_selection=True, export_apply=False, export_animations=True, export_animation_mode='NLA_TRACKS',
        export_force_sampling=True, export_frame_step=1, export_def_bones=True, export_optimize_animation_size=True, export_anim_single_armature=True,
        export_reset_pose_bones=True, export_skins=True, export_all_influences=False, export_morph=False, export_image_format='AUTO', export_texcoords=True,
        export_normals=True, export_tangents=False, export_materials='EXPORT', export_yup=True, export_cameras=False, export_lights=False, export_extras=False)
    print('BUILT', out, os.path.getsize(out), 'bytes', [(n, [round(v) for v in bpy.data.actions[n].frame_range]) for n, _ in CLIPS])

mode = POS[0] if POS else ''
if mode == 'survey': survey(POS[1], POS[2], POS[3:])
elif mode == 'analyze': analyze(POS[1], POS[3:], POS[2])
elif mode == 'build': build(POS[1], POS[2], POS[3], KW.get('check'))
else: sys.exit('usage: survey <skin.fbx> <out-dir> <clips...>')
