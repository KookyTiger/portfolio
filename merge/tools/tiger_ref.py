"""Export the site tiger as a still reference for modelling accessories on (Kay's wardrobe, 2026-10-01):
    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P merge/tools/tiger_ref.py -- assets/tiger/tiger.glb assets/src/tiger/tiger-ref.glb
The mesh in its bind pose (T-pose), no rig, no clips, same coordinates and units as tiger.glb, so an accessory modelled on it and
exported with transforms applied lands on the tiger at runtime (app.js wearItem converts its placement into the bone's space)."""
import bpy, sys, os
src, dst = sys.argv[sys.argv.index('--') + 1:][:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.abspath(src))
arms = [o for o in bpy.data.objects if o.type == 'ARMATURE']; meshes = [o for o in bpy.data.objects if o.type == 'MESH']
for a in arms: a.data.pose_position = 'REST'; a.animation_data_clear()
bpy.context.view_layer.update()
for m in meshes:
    m.animation_data_clear()
    bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active = m; m.select_set(True)
    for mod in list(m.modifiers):
        if mod.type == 'ARMATURE': bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')      # keep the Armature's rotation + 0.01 scale: metres, standing up
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for a in arms: bpy.data.objects.remove(a, do_unlink=True)
for o in bpy.data.objects: o.select_set(o.type == 'MESH')
bpy.ops.export_scene.gltf(filepath=os.path.abspath(dst), export_format='GLB', use_selection=True, export_animations=False, export_skins=False, export_apply=True)
m = meshes[0]; xs = [v.co.x for v in m.data.vertices]; ys = [v.co.y for v in m.data.vertices]; zs = [v.co.z for v in m.data.vertices]
print('REF', dst, 'size x %.3f y %.3f z %.3f' % (max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)), 'min z %.3f max z %.3f' % (min(zs), max(zs)), 'tris', len(m.data.polygons))
