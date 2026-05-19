# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**Mecatronica Gear Designer** — a parametric web tool for designing gear trains, calculating ratios/RPM/center distances, visualizing gears in 2D/3D, and exporting SVG/DXF/STL/STEP.

**Current state (Session 1 complete):** Vite + React + TypeScript project with math core fully implemented and tested. The app serves a minimal live gear preview. `index.prototype.html` is the original vanilla prototype kept for visual reference.

## Commands

```
npm run dev      # Dev server at http://localhost:5173
npm test         # Vitest (34 tests, all passing)
npm run build    # Production build (TypeScript strict mode)
npm run test:watch  # Vitest in watch mode
```

## Architecture

```
src/
  core/           # Pure math — NO React imports here
    gearTypes.ts  # All TypeScript types (freeze after Session 1)
    gearMath.ts   # pitchDiameter, outerDiameter, rootDiameter, baseDiameter, centerDistance
    gearRatios.ts # gearRatio, outputRpm, rotationDirection, compoundTrainRatio
    validation.ts # ValidationWarning, validateSpurGear, validateGearPair
  geometry/       # SVG path generation
    simplePreviewGear.ts  # makeSimpleGearPath (alternating radii, module-aware)
    involute.ts           # (Session 5) real involute parametric equation
    spurGear2D.ts         # (Session 5) full involute SVG path
  exporters/      # (Session 6+) SVG, DXF, JSON, STL exporters
  state/
    useGearStore.ts   # Zustand store with GearDesignState
    serialization.ts  # serializeState/deserializeState (base64 JSON URL hash)
  ui/
    components/   # (Session 2) TopBar, SidePanel, GearCanvas, SegmentedControl…
  styles/
    tokens.css    # All CSS custom properties — source of truth for the palette
    global.css    # Resets, layout shell (moves to CSS Modules in Session 2)
  tests/
    gearMath.test.ts
    gearRatios.test.ts
    serialization.test.ts
```

**Core constraint:** React components must never contain gear math formulas. All calculations live in `src/core/` as pure TypeScript functions.

**File size rule:** No single file should exceed 250 lines unless strictly necessary.

## Key gear formulas (spur gear, module-based)

```
pitchDiameter    = module * teeth
outerDiameter    = module * (teeth + 2)
rootDiameter     = module * (teeth - 2.5)
baseDiameter     = pitchDiameter * cos(pressureAngle)
circularPitch    = π * module
centerDistance   = (D1 + D2) / 2          // external pair
rpm_out          = −rpm_in × teeth_in / teeth_out
```

Willis equation for planetary sets:
```
(ω_sun − ω_carrier) / (ω_ring − ω_carrier) = −N_ring / N_sun
```

## Design tokens (src/styles/tokens.css)

```
--red: #e60023          (primary accent)
--red-deep: #c8001e     (hover)
--red-soft: #fff1f2     (hover background)
--bg: #fafbfc           (app background)
--text: #52545a
--text-strong: #1a1c1f
--text-muted: #9aa0a6
--font-display: Space Grotesk
--font: Inter
--font-mono: JetBrains Mono
```

## State model

`GearDesignState` (in `src/core/gearTypes.ts`) is JSON-serializable for URL-hash sharing via `btoa/atob`. Includes `schemaVersion: 1` for future migrations. Initial state (in `useGearStore.ts`): g1=54T output, g2=18T input, module 2mm, 20° PA.

## Session roadmap

| Session | Status | Deliverable |
|---|---|---|
| 1 | ✅ Done | Scaffold + math core (34 tests) + minimal SVG preview |
| 2 | Next | Full React UI components matching `index.prototype.html` visually |
| 3 | — | Module/pressure angle/units affect math live |
| 4 | — | Gear auto-layout from center distance (no hardcoded positions) |
| 5 | — | Real involute 2D geometry (`involute.ts`, `spurGear2D.ts`) |
| 6 | — | SVG export (mm scale, cut lines, metadata) |
| 7 | — | DXF export (R12 ASCII, layers: CUT/BORE/CONSTRUCTION) |
| 8 | — | Compound gear train |
| 9 | — | Internal gear + Planetary (Willis equation) |
| 10 | — | Rack and Pinion |
| 11 | — | 3D extrusion + STL (Three.js, dynamic import) |
| 12 | — | FreeCAD/CadQuery script + GitHub Pages deploy |

## Visual reference

`index.prototype.html` — original vanilla prototype. Open directly in a browser. Use for pixel-level comparison in Session 2 when porting UI components.

## Critical risks documented

- **Session 5 (involute):** tooth spacing is `2π/teeth`, not `π/teeth`. Base circle must not exceed pitch circle. Validate against geargenerator.com with 20T, module 2, 20° PA.
- **Session 7 (DXF):** Use R12 ASCII. Test that exported DXF measures exactly 108mm pitch diameter in LibreCAD for 54T module 2.
- **Session 9 (planetary):** Enforce `N_ring = N_sun + 2 × N_planet`. Willis requires fixing 2 of 3 DOF.
- **Session 11 (Three.js):** Dynamic import only (`await import('three')`), never static — keeps initial bundle small.
