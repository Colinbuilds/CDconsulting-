# CAD builder: plan

A desktop-first building designer that does three things:
- builds a structure by clicking points that walls snap between
- produces a printable blueprint
- lets you walk through the result at eye level

It lives as its own part of the site (`/builder`) and reuses the three.js stack that is already in place.

## 1. How it works for the user
1. **Start a plan.** Pick a lot size, or trace the lot from the county GIS parcel the roof quote already uses.
2. **Draw walls (2D plan view).** Click dots on a snap grid (6 in / 1 ft). Each click adds a wall to the chosen wall type. Double-click ends a run, and clicking the first dot closes a room.
   - Rooms are detected automatically from closed loops, and their area is labeled.
   - Wall types: 2×4 / 2×6 wood, steel stud, CMU, brick veneer. Each is a layered assembly: framing, sheathing, weather barrier, cladding, interior drywall.
3. **Drop openings.** Click a wall to place a window or door. It snaps to the wall, carries its size and a header, and can be dragged along the wall.
4. **Add floors.** Each floor is a level with its own height. Stairs connect levels.
5. **Roof.** Pick hip, gable, shed or flat. The roof is generated from the outer wall loop at the chosen pitch, with overhangs. Chimneys, pipe boots and vents sit on it the way equipment does in the commercial planner.
6. **Systems layers.** Plumbing, HVAC and electrical each get their own layer and can be toggled on and off.
   - Click to place fixtures, registers, outlets and switches.
   - Draw runs between them.
7. **Furnish.** Drag in appliances, cabinets and furniture from a catalog.
8. **Walk through.** One button drops you in at 5'6" eye height with WASD and mouse-look, and you collide with walls. A floor picker moves you between levels.
9. **Output.**
   - Blueprint sheets: floor plans with dimensions, elevations, roof plan, a door/window schedule, and an electrical plan.
   - Material takeoff: wall area by assembly, squares of roofing, window and door counts, linear feet of trim.
   - "Send to Colin" attaches the plan file and a render to the lead form, as the visualizer already does.

## 2. Data model (the part to get right first)
Everything is one JSON document. The 3D model, the 2D plan, the blueprint and the takeoff are all *derived* from it, so they never disagree.

```
Project { lot, levels: [Level], roof, catalogs }
Level   { elevation, height, nodes: [{id, x, y}], walls: [Wall], openings: [Opening],
          rooms (derived), fixtures: [Fixture], runs: [Run] }
Wall    { id, a: nodeId, b: nodeId, assembly: "wood-2x6-vinyl", height?, thickness (from assembly) }
Opening { wallId, t (0..1 along wall), type: "window"|"door", product, width, height, sill }
Fixture { type: "sink"|"outlet"|"register"|"fridge"|…, x, y, rot, level }
Run     { system: "plumbing"|"hvac"|"electrical", points: [...], size }
Assembly{ layers: [{ material, thickness }] }  // e.g. drywall, 2x6 @16", OSB, WRB, siding
```

Walls share **nodes**, so dragging a corner moves every wall attached to it. Undo/redo is simply a stack of document snapshots.

## 3. Build order (each step is shippable)
| Phase | What ships | Effort |
|---|---|---|
| 1 | 2D plan editor: grid, snap, click-to-draw walls, shared nodes, room detection, dimensions, undo/redo, save/load (localStorage + export file) | 2–3 weeks |
| 2 | Live 3D view of the same document: extruded walls with real assemblies, window/door cutouts, floor slabs, multiple levels | 2 weeks |
| 3 | Roof generator (gable/hip/shed/flat from the wall loop) + roof items (chimney, boots, vents), reusing the house model's shingle and metal materials | 2 weeks |
| 4 | Walk-through mode (pointer lock, collision, stairs, level switching) | 1 week |
| 5 | Catalogs: windows/doors (reuse `catalog.js`), siding, decks, entryways, appliances, furniture (glTF models) | 2 weeks + modeling |
| 6 | Systems layers: plumbing, HVAC, electrical symbols and runs; toggleable | 2 weeks |
| 7 | Blueprint output: SVG sheets → PDF (title block, scale, dimensions, schedules), material takeoff to CSV | 2 weeks |
| 8 | Accounts + cloud save (so plans live on the server and come in with the lead) | 1 week |

## 4. Tech choices
- **three.js** (already vendored): 3D view and walkthrough. Use `CSG` / `three-bvh-csg` to cut openings into walls, and `PointerLockControls` for the walk-through.
- **2D plan:** SVG or a canvas layer using the same coordinates as the 3D view, which makes printing blueprints and dimension lines straightforward.
- **Room detection:** planar graph faces from the wall/node graph.
- **Roof generation:** straight-skeleton algorithm for hip roofs (libraries exist), plus simple extrusions for gable and shed roofs.
- **Furniture and appliances:** glTF models from free CC0 libraries (Poly Haven models, Kenney furniture kit), loaded on demand.
- **Exports:** PDF via the browser's print-to-PDF of the SVG sheets (no server cost), CSV takeoff, and the project JSON for re-opening. DXF export (for real CAD software) can be added later.
- **Desktop only at first:** show a "best on a computer" notice on phones, with a read-only 3D view.

## 5. Keeping it honest
These are design drawings, not stamped construction documents. The blueprint title block should say "For design and estimating only, not for construction," and anything structural (spans, headers, loads) should be flagged for an engineer.

## 6. Where it pays off for the business
- Every plan becomes a lead with a material takeoff attached, so the project is already scoped.
- The takeoff can feed the estimator: roofing squares, siding area and window counts produce a price directly.
- The same document can drive the existing visualizer and walkthroughs for the exterior look.
