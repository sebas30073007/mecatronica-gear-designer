# Mecatronica Gear Designer — Plan de desarrollo con IA/Codex

## 0. Visión del proyecto

**Mecatronica Gear Designer** será una herramienta web paramétrica para diseñar, visualizar, calcular y exportar sistemas de engranes de forma simple para ingeniería mecatrónica.

La intención no es iniciar como un CAD industrial completo, sino como una herramienta práctica para responder rápidamente preguntas de diseño:

- ¿Qué reducción necesito?
- ¿Qué número de dientes puedo usar?
- ¿Cuál será la velocidad de salida?
- ¿Cuál será el sentido de giro?
- ¿Qué distancia entre centros necesito?
- ¿Qué configuración me conviene: simple, compuesta, planetaria, rack & pinion, worm gear, etc.?
- ¿Puedo exportar una geometría útil para corte láser, impresión 3D o documentación técnica?

El proyecto debe construirse desde el inicio con una base sólida, modular y escalable, pensando en que más adelante podrá generar archivos **SVG, DXF, DWG, STL y STEP**.

---

## 1. Principios de desarrollo

### 1.1. Primero simulador, después CAD

No intentar resolver todos los tipos de engranes en 3D desde el inicio. El orden correcto debe ser:

1. **Modelo matemático y cinemático.**
2. **Visualización 2D simple.**
3. **Generación geométrica 2D exportable.**
4. **Exportación DXF/SVG.**
5. **Modelado 3D básico.**
6. **Exportación STL/STEP.**
7. **Tipos avanzados de engranes.**

### 1.2. Separar cálculo, geometría, visualización y exportación

El proyecto debe evitar mezclar lógica matemática con componentes visuales. La arquitectura ideal debe separar:

```txt
src/
  core/          # Matemática, relaciones, cinemática, validaciones
  geometry/      # Generación de perfiles 2D/3D
  exporters/     # SVG, DXF, STL, STEP, etc.
  ui/            # Componentes visuales
  state/         # Estado global del diseñador
  presets/       # Configuraciones de ejemplo
  tests/         # Pruebas unitarias
```

### 1.3. Todo diseño debe ser serializable

Inspirado en herramientas como Gear Generator y Falstad, el estado del diseño debe poder guardarse en el URL.

Ejemplo deseado:

```txt
https://app.com/#gearDesign=eyJnZWFycyI6W119...
```

Esto permite compartir diseños sin base de datos al inicio.

### 1.4. La UI debe ser minimalista y técnica

La estética inicial debe conservar el estilo del primer front:

- Fondo blanco/gris claro.
- Grid técnico tipo ingeniería.
- Acento rojo `#ff0000`, usado con moderación.
- Tipografía limpia.
- Panel lateral simple.
- Área central tipo canvas técnico.
- Controles grandes, claros y fáciles de usar.

---

## 2. Stack recomendado

### Frontend

Usar:

```txt
Vite + React + TypeScript
```

Razones:

- Rápido para prototipar.
- Fácil de mantener con IA/Codex.
- Compatible con GitHub Pages.
- TypeScript ayuda a que Codex no rompa estructuras.

### Visualización 2D

Usar **SVG** como primer motor visual.

Razones:

- Es simple.
- Es editable.
- Se puede exportar directamente.
- Permite zoom, pan, layers, paths y estilos técnicos.
- Es ideal para engranes 2D.

Evitar Canvas al inicio, porque exportar geometría limpia desde SVG será más fácil.

### Estado

Usar Zustand o React Context. Para MVP, Zustand es recomendable.

```txt
zustand
```

### Geometría 2D

Comenzar con funciones propias para engranes simples.

Después evaluar librerías como:

```txt
maker.js
polygon-clipping
clipper-lib
```

### DXF

Evaluar:

```txt
dxf-writer
@tarikjabiri/dxf
maker.js export DXF
```

### STL

Para STL, usar más adelante:

```txt
three.js
three-csg-ts
@jscad/modeling
```

### STEP

STEP es más complejo. No debe ser prioridad inicial.

Opciones futuras:

```txt
OpenCascade.js
CadQuery vía backend Python
FreeCAD script exportable
```

Recomendación práctica: antes que generar STEP directamente en navegador, generar un script paramétrico para FreeCAD o CadQuery.

---

## 3. Arquitectura propuesta

```txt
mecatronica-gear-designer/
  README.md
  package.json
  vite.config.ts
  index.html
  src/
    main.tsx
    App.tsx

    core/
      units.ts
      gearTypes.ts
      gearMath.ts
      gearRatios.ts
      planetaryMath.ts
      validation.ts

    geometry/
      involute.ts
      spurGear2D.ts
      internalGear2D.ts
      rack2D.ts
      simplePreviewGear.ts
      paths.ts

    exporters/
      exportSvg.ts
      exportDxf.ts
      exportJson.ts
      exportStl.ts
      exportStep.ts

    state/
      useGearStore.ts
      serialization.ts
      presets.ts

    ui/
      components/
        TopBar.tsx
        SidePanel.tsx
        SegmentedControl.tsx
        NumberInput.tsx
        GearCanvas.tsx
        GearNode.tsx
        GridBackground.tsx
        ExportMenu.tsx
      pages/
        DesignerPage.tsx

    styles/
      tokens.css
      global.css

    tests/
      gearMath.test.ts
      gearRatios.test.ts
      serialization.test.ts
```

---

## 4. Modelo de datos base

Codex debe construir el proyecto con tipos explícitos desde el inicio.

```ts
export type UnitSystem = 'metric' | 'imperial';

export type GearKind =
  | 'spur'
  | 'internal'
  | 'rackPinion'
  | 'planetary'
  | 'bevel'
  | 'helical'
  | 'worm'
  | 'herringbone';

export type GearConnection =
  | 'mesh'
  | 'sameAxis'
  | 'fixed'
  | 'free';

export interface BaseGear {
  id: string;
  name: string;
  kind: GearKind;
  teeth: number;
  moduleMm: number;
  pressureAngleDeg: number;
  x: number;
  y: number;
  rotationDeg: number;
  rpm?: number;
  parentId?: string;
  connection?: GearConnection;
  isInput?: boolean;
  isOutput?: boolean;
  isFixed?: boolean;
}

export interface SpurGear extends BaseGear {
  kind: 'spur';
  boreDiameterMm: number;
  thicknessMm: number;
}

export interface InternalGear extends BaseGear {
  kind: 'internal';
  outerDiameterMm?: number;
  thicknessMm: number;
}

export interface PlanetaryGearSet {
  id: string;
  kind: 'planetary';
  sunTeeth: number;
  planetTeeth: number;
  ringTeeth: number;
  planetCount: number;
  moduleMm: number;
  pressureAngleDeg: number;
  input: 'sun' | 'ring' | 'carrier';
  fixed: 'sun' | 'ring' | 'carrier';
  output: 'sun' | 'ring' | 'carrier';
  inputRpm: number;
}

export interface GearDesignState {
  projectName: string;
  unitSystem: UnitSystem;
  activeMode: 'simple' | 'compound' | 'planetary' | 'library';
  gears: BaseGear[];
  planetarySets: PlanetaryGearSet[];
  selectedId?: string;
  view: {
    zoom: number;
    panX: number;
    panY: number;
    showGrid: boolean;
    mode: '2d' | '3d';
  };
}
```

---

## 5. Fórmulas mínimas para la primera versión

### 5.1. Engrane recto externo

```txt
pitchDiameter = module * teeth
pitchRadius = pitchDiameter / 2
outerDiameter = module * (teeth + 2)
rootDiameter = module * (teeth - 2.5)
baseDiameter = pitchDiameter * cos(pressureAngle)
circularPitch = pi * module
```

### 5.2. Distancia entre centros

Para dos engranes externos:

```txt
centerDistance = (D1 + D2) / 2
```

Para engrane externo con engrane interno:

```txt
centerDistance = (D_internal - D_external) / 2
```

### 5.3. Relación de transmisión

Para engranes externos:

```txt
rpm2 = -rpm1 * teeth1 / teeth2
ratio = teeth2 / teeth1
```

Para engranes en el mismo eje:

```txt
rpm2 = rpm1
```

Para tren compuesto:

```txt
totalRatio = product(stageRatios)
```

### 5.4. Planetario básico

Ecuación de Willis:

```txt
(omega_sun - omega_carrier) / (omega_ring - omega_carrier) = -N_ring / N_sun
```

Esta fórmula debe implementarse después del MVP simple.

---

## 6. Tipos de engranes y prioridad realista

La imagen de referencia incluye varios tipos. No todos deben implementarse al mismo tiempo.

### Prioridad A — MVP funcional

1. Spur Gear / engrane recto externo.
2. Internal Gear / engrane interno.
3. Simple Gear Train.
4. Compound Gear Train.
5. Planetary Gear Set básico.
6. Exportación SVG.
7. Exportación DXF 2D.

### Prioridad B — Versión intermedia

8. Rack and Pinion.
9. Engrane helicoidal visual simplificado.
10. Engrane bevel visual simplificado.
11. Exportación STL por extrusión simple.
12. Presets educativos.

### Prioridad C — Avanzado

13. Worm Gear.
14. Spiral Bevel Gear.
15. Miter Gear.
16. Double Helical / Herringbone.
17. STEP paramétrico.
18. Validaciones de manufactura.
19. Tolerancias para corte láser e impresión 3D.
20. Simulación avanzada de contacto.

---

## 7. Roadmap por etapas

## Etapa 1 — Base sólida del proyecto

### Objetivo
Crear el proyecto frontend con arquitectura limpia, estilos base, layout inicial y estado serializable.

### Entregables

- Proyecto Vite + React + TypeScript.
- Pantalla principal con:
  - Top bar.
  - Logo “MECATRONICA”.
  - Panel lateral.
  - Canvas SVG con grid.
  - Botón 2D/3D visual, aunque 3D todavía no haga nada.
  - Botón Export.
- Sistema de diseño inicial:
  - Rojo `#ff0000` como acento.
  - Fondo `#f6f7f8`.
  - Grid `#e4e4e7`.
  - Texto `#6b6d6e`.
- Estado global inicial.
- Serialización básica a URL hash.

### Criterio de terminado

Al cambiar dientes, módulo o ratio, la UI debe actualizar el estado sin errores. El estado debe poder copiarse en el URL y restaurarse al recargar.

### Prompt sugerido para Codex

```txt
Build the initial Vite + React + TypeScript project for Mecatronica Gear Designer.
Create a clean architecture with src/core, src/geometry, src/exporters, src/state, src/ui, and src/styles.
Implement a minimal technical UI inspired by the provided mockup: white top bar, left settings panel, central SVG grid canvas, red accent color #ff0000, light background #f6f7f8, grid #e4e4e7, text #6b6d6e.
Add Zustand state for GearDesignState and implement URL hash serialization/deserialization using base64 JSON.
Do not implement complex gear geometry yet; use placeholder gear circles with teeth-like polygons.
```

---

## Etapa 2 — Motor matemático de engranes simples

### Objetivo
Implementar cálculos confiables de engranes rectos externos.

### Entregables

- `gearMath.ts` con:
  - pitch diameter.
  - outer diameter.
  - root diameter.
  - base diameter.
  - circular pitch.
  - center distance.
- `gearRatios.ts` con:
  - ratio entre dos engranes.
  - rpm de salida.
  - sentido de giro.
- Tests unitarios.

### Criterio de terminado

Dado un engrane input de 18 dientes y uno output de 54 dientes, el sistema debe calcular ratio 3:1 y salida a 1/3 de la velocidad de entrada.

### Prompt sugerido para Codex

```txt
Implement the core gear math layer for spur gears.
Create pure TypeScript functions for module-based pitch diameter, outer diameter, root diameter, base diameter, circular pitch, external gear center distance, and gear ratio/RPM calculation.
Add unit tests for common cases: 18 to 54 teeth gives 3:1 reduction; same-axis gears keep RPM; external mesh reverses direction.
Keep all functions independent from React.
```

---

## Etapa 3 — Visualización 2D paramétrica simple

### Objetivo
Dibujar engranes funcionales en SVG, aunque todavía no sean involutas perfectas.

### Entregables

- `simplePreviewGear.ts` para generar un path o polygon tipo engrane.
- Render de engranes con:
  - dientes visibles.
  - centro marcado.
  - círculo de pitch opcional.
  - diámetro interno/bore.
- Posicionamiento automático de dos engranes según distancia entre centros.
- Animación opcional por RPM.

### Criterio de terminado

La app debe mostrar visualmente dos engranes conectados, con tamaños proporcionales al número de dientes y módulo.

### Prompt sugerido para Codex

```txt
Create an SVG-based parametric preview gear renderer.
Generate a simplified gear polygon using alternating inner and outer radii for each tooth.
Use module and teeth to scale the gear visually.
Place two gears automatically using center distance.
Show center points, optional pitch circle, and basic rotation animation based on RPM.
Do not implement involute geometry yet.
```

---

## Etapa 4 — UI de configuración para tren simple

### Objetivo
Convertir el primer mockup en una UI funcional para diseño de reducción simple.

### Entregables

- Panel lateral con:
  - tipo: Simple / Compound / Planetary.
  - ratio target.
  - dientes input/output.
  - módulo.
  - distancia entre centros calculada.
  - ángulo de presión.
  - unidades.
- La app debe recalcular automáticamente:
  - ratio.
  - distancia entre centros.
  - RPM de salida.
- Mensajes de validación simples.

### Criterio de terminado

El usuario puede cambiar dientes input/output y módulo; el canvas se actualiza y el panel muestra ratio y center distance.

### Prompt sugerido para Codex

```txt
Implement the functional side panel for Simple Gear Train mode.
The user can edit input teeth, output teeth, module, pressure angle, units, and input RPM.
Compute ratio, output RPM, and center distance live using the core functions.
Update the SVG preview immediately.
Follow the existing minimal UI style and keep controls large and clean.
```

---

## Etapa 5 — Geometría involuta 2D real

### Objetivo
Generar perfiles reales de engrane recto involuto para exportación 2D.

### Entregables

- `involute.ts`:
  - generación de curva involuta.
  - puntos de flanco izquierdo/derecho.
  - replicación por diente.
- `spurGear2D.ts`:
  - path cerrado del engrane.
  - bore central.
  - parámetros de calidad/resolución.
- Validaciones:
  - número mínimo de dientes recomendado.
  - pressure angle válido.
  - root diameter no negativo.

### Criterio de terminado

La app debe poder alternar entre:

- preview simple.
- geometría involuta real.

### Prompt sugerido para Codex

```txt
Implement real 2D involute spur gear geometry generation.
Create pure TypeScript functions that generate a closed SVG path for a spur gear using module, teeth, pressure angle, bore diameter, and quality settings.
Use the involute parametric equation from the base circle to the outer circle.
Mirror the flank and replicate it for all teeth.
Keep the output as arrays of 2D points and an SVG path string.
Add validation warnings for low tooth counts and invalid root diameter.
```

---

## Etapa 6 — Exportación SVG

### Objetivo
Exportar el diseño 2D como archivo SVG usable.

### Entregables

- `exportSvg.ts`.
- Exportar:
  - engranes como paths.
  - escala real en mm.
  - metadata del proyecto.
  - capas opcionales:
    - cut lines.
    - construction lines.
    - labels.

### Criterio de terminado

El usuario descarga un SVG que puede abrir en navegador, Illustrator, Inkscape o software de corte.

### Prompt sugerido para Codex

```txt
Implement SVG export for the current gear design.
The exported SVG must use mm units, include a correct viewBox, and contain paths for gear cut outlines and bore holes.
Add optional metadata comments with gear parameters.
Allow exporting only cut lines or cut lines plus construction lines.
```

---

## Etapa 7 — Exportación DXF 2D

### Objetivo
Exportar geometría 2D para corte láser o CAD.

### Entregables

- `exportDxf.ts`.
- DXF con:
  - polilíneas cerradas.
  - unidades en mm.
  - capas:
    - CUT.
    - BORE.
    - CONSTRUCTION.
    - LABELS.

### Criterio de terminado

El archivo DXF debe abrir correctamente en LibreCAD, AutoCAD, Fusion 360 o software CAM.

### Prompt sugerido para Codex

```txt
Implement DXF export for the generated 2D gear geometry.
Use a lightweight DXF writer library or generate a minimal ASCII DXF manually.
Export closed polylines for gear outlines and bore circles.
Create layers: CUT, BORE, CONSTRUCTION, LABELS.
Use millimeters as units.
Add a test fixture that exports a 20-tooth gear with module 2 and bore diameter 8 mm.
```

---

## Etapa 8 — Tren compuesto

### Objetivo
Permitir varios engranes conectados en cadena, incluyendo engranes en el mismo eje.

### Entregables

- Agregar modo Compound.
- Lista de etapas.
- Engrane input, engranes intermedios y output.
- Conexiones:
  - mesh.
  - same axis.
- Cálculo de ratio total.
- Visualización automática en SVG.

### Criterio de terminado

El usuario puede crear una reducción compuesta de dos etapas y la app calcula la reducción total correctamente.

### Prompt sugerido para Codex

```txt
Implement Compound Gear Train mode.
Allow the user to define multiple stages with mesh and same-axis connections.
Compute total gear ratio, output RPM, and rotation direction across the train.
Render the gear train in SVG with automatic layout.
Keep the data model extensible and serializable.
```

---

## Etapa 9 — Engrane interno y planetario básico

### Objetivo
Agregar engranes internos y sets planetarios.

### Entregables

- `internalGear2D.ts`.
- Modo Planetary.
- Parámetros:
  - sun teeth.
  - planet teeth.
  - ring teeth.
  - planet count.
  - input/fixed/output.
  - input RPM.
- Cálculo mediante fórmula de Willis.
- Visualización 2D.

### Criterio de terminado

La app debe calcular el ratio de un planetario básico y mostrar sun, planet gears, ring gear y carrier.

### Prompt sugerido para Codex

```txt
Implement basic internal gear and planetary gear set support.
Add internal gear geometry as a 2D ring with inward teeth.
Implement Willis equation for planetary gear ratios.
Create a Planetary mode where the user selects input, fixed, and output among sun, ring, and carrier.
Render sun, planet gears, ring gear, and carrier in SVG.
```

---

## Etapa 10 — Rack and Pinion

### Objetivo
Agregar conversión entre rotación y desplazamiento lineal.

### Entregables

- Rack 2D paramétrico.
- Pinion conectado a rack.
- Cálculo:
  - avance lineal por vuelta.
  - velocidad lineal.
- Exportación SVG/DXF.

### Criterio de terminado

El usuario puede diseñar un rack & pinion básico y saber cuánto avanza por vuelta.

### Prompt sugerido para Codex

```txt
Add Rack and Pinion mode.
Generate a parametric 2D rack profile compatible with a spur gear module and pressure angle.
Compute linear travel per revolution and linear speed from pinion RPM.
Render the rack and pinion in SVG and support SVG/DXF export.
```

---

## Etapa 11 — Extrusión 3D simple y STL

### Objetivo
Generar engranes 3D básicos por extrusión de perfiles 2D.

### Entregables

- Extrusión de spur gear 2D.
- Espesor configurable.
- Bore central.
- Exportación STL.
- Vista 3D básica con Three.js.

### Criterio de terminado

El usuario puede exportar un STL de un engrane recto simple.

### Prompt sugerido para Codex

```txt
Implement basic 3D extrusion for spur gears.
Use the existing 2D involute profile and extrude it by thickness to create a simple 3D mesh.
Render it in a Three.js preview and export it as STL.
Support bore holes if feasible; otherwise document bore support as pending.
```

---

## Etapa 12 — STEP / CAD paramétrico

### Objetivo
Explorar exportación CAD real.

### Recomendación
No empezar con STEP nativo en navegador.

Primero generar scripts:

- FreeCAD Python script.
- CadQuery script.
- OpenSCAD script.

Después evaluar OpenCascade.js.

### Entregables

- Exportar `.py` para FreeCAD o CadQuery.
- El script debe reconstruir el engrane con parámetros.
- Documentar flujo:
  - Descargar script.
  - Abrir en FreeCAD/CadQuery.
  - Exportar STEP.

### Prompt sugerido para Codex

```txt
Add a CAD script exporter instead of direct STEP export.
Generate a FreeCAD Python or CadQuery script from the current gear parameters.
The script should reconstruct a spur gear using the same 2D profile and extrude it to the selected thickness, then export STEP when run locally.
Document this as an intermediate STEP workflow.
```

---

## 8. Hitos principales

### Hito 1 — UI navegable

La app se ve como una herramienta técnica real, aunque use engranes placeholder.

### Hito 2 — Calculadora de reducción simple

La app calcula ratio, RPM y distancia entre centros para dos engranes.

### Hito 3 — Preview SVG paramétrico

La app dibuja engranes proporcionales y animables.

### Hito 4 — Geometría involuta

La app genera perfiles 2D reales de engranes rectos.

### Hito 5 — SVG exportable

El usuario puede descargar un SVG útil.

### Hito 6 — DXF exportable

El usuario puede descargar un DXF para corte láser.

### Hito 7 — Tren compuesto

La app permite reducciones de varias etapas.

### Hito 8 — Planetario básico

La app calcula y dibuja un set planetario.

### Hito 9 — Rack and Pinion

La app convierte rotación en movimiento lineal.

### Hito 10 — STL básico

La app exporta engranes rectos 3D simples.

### Hito 11 — Flujo STEP mediante script CAD

La app genera un archivo paramétrico que puede abrirse en FreeCAD/CadQuery para exportar STEP.

---

## 9. Definición de MVP realista

El MVP no debe prometer todos los engranes de la imagen.

El MVP debe incluir:

```txt
Simple Gear Train
Spur Gear externo
Cálculo ratio/RPM
Distancia entre centros
Preview 2D SVG
Estado en URL
Export JSON
Export SVG
```

El MVP Plus debe incluir:

```txt
Geometría involuta real
Export DXF
Compound Gear Train
Internal Gear básico
Planetary básico
```

El proyecto avanzado debe incluir:

```txt
Rack & Pinion
STL
STEP workflow
Helical visual
Bevel visual
Worm Gear
Herringbone
```

---

## 10. Reglas para trabajar con Codex

### 10.1. Pedir cambios pequeños

No pedir “haz toda la app”. Pedir una etapa completa, pero acotada.

Correcto:

```txt
Implement gearMath.ts and add tests.
```

Incorrecto:

```txt
Build the entire gear generator with DXF, STL and STEP.
```

### 10.2. Siempre pedir tests para core

Todo lo que sea cálculo debe tener pruebas.

Prioridad de tests:

```txt
gearMath
gearRatios
planetaryMath
serialization
exportSvg
exportDxf
```

### 10.3. Congelar interfaces

Antes de avanzar demasiado, definir bien los tipos TypeScript. Si el modelo de datos cambia mucho, Codex romperá cosas.

### 10.4. Separar visual de cálculo

Los componentes React no deben tener fórmulas importantes. Las fórmulas deben vivir en `src/core`.

### 10.5. Mantener archivos pequeños

Pedir a Codex que evite archivos gigantes.

Regla sugerida:

```txt
No file should exceed 250 lines unless strictly necessary.
```

### 10.6. Documentar cada etapa

Cada etapa debe actualizar:

```txt
README.md
CHANGELOG.md
/docs/roadmap.md
```

---

## 11. Backlog técnico

### Cálculo

- [ ] módulo métrico.
- [ ] diametral pitch.
- [ ] conversión mm/in.
- [ ] ratio externo.
- [ ] ratio interno.
- [ ] tren compuesto.
- [ ] planetario.
- [ ] rack & pinion.
- [ ] velocidad lineal.
- [ ] torque estimado.

### Geometría 2D

- [ ] preview simple.
- [ ] involuta spur.
- [ ] internal gear.
- [ ] rack.
- [ ] bore.
- [ ] keyway.
- [ ] mounting holes.
- [ ] tolerancia de corte láser.
- [ ] backlash configurable.

### Exportación

- [ ] JSON.
- [ ] SVG.
- [ ] DXF.
- [ ] STL.
- [ ] FreeCAD script.
- [ ] CadQuery script.
- [ ] STEP directo.
- [ ] DWG.

Nota: DWG es propietario y más difícil. Es más realista exportar DXF y permitir que el usuario convierta a DWG en AutoCAD/Fusion/LibreCAD.

### UI

- [ ] panel simple.
- [ ] panel compuesto.
- [ ] panel planetario.
- [ ] biblioteca de tipos.
- [ ] presets.
- [ ] export modal.
- [ ] warnings.
- [ ] modo educativo.
- [ ] modo fabricación.

---

## 12. Riesgos técnicos

### 12.1. DXF y tolerancias

Un DXF que “se ve bien” no necesariamente sirve para fabricación. Hay que validar:

- unidades.
- escala.
- polilíneas cerradas.
- capas correctas.
- orientación.
- tolerancia/backlash.

### 12.2. STL no garantiza funcionalidad mecánica

Un STL puede imprimirse, pero eso no significa que el engrane funcione bien. Se deben incluir advertencias sobre:

- holgura.
- material.
- resolución de impresión.
- backlash.
- ancho del diente.
- carga esperada.

### 12.3. STEP directo es difícil

STEP no debe prometerse en la primera versión. Primero usar flujo FreeCAD/CadQuery.

### 12.4. Tipos complejos de engranes

Helical, bevel, worm y herringbone son bastante más complejos que spur gear. Se pueden visualizar antes de modelar con precisión.

---

## 13. Recomendación estratégica

La mejor forma de desarrollar este proyecto es en tres productos progresivos:

### Producto 1 — Gear Ratio Designer

Enfocado en relación, RPM, distancia entre centros y visualización simple.

### Producto 2 — Gear DXF Generator

Enfocado en geometría 2D real y corte láser.

### Producto 3 — Gear CAD Generator

Enfocado en STL/STEP, impresión 3D y modelado CAD.

Esto evita que el proyecto se vuelva inmanejable desde el inicio.

---

## 14. Primer prompt maestro para iniciar con Codex

```txt
You are helping me build Mecatronica Gear Designer, a parametric web app for mechatronics students and engineers to design gear trains, calculate ratios/RPM/center distances, visualize gears in 2D, and eventually export SVG/DXF/STL/STEP files.

Use Vite + React + TypeScript.
Use SVG for the first 2D rendering engine.
Keep the architecture modular:
- src/core for math and kinematics
- src/geometry for 2D/3D geometry generation
- src/exporters for SVG/DXF/STL/STEP exporters
- src/state for Zustand store and URL serialization
- src/ui for React components
- src/styles for design tokens and global CSS

Important principles:
1. Do not mix React UI with gear math.
2. All calculations must be pure TypeScript functions with tests.
3. The current design state must be serializable to the URL hash using base64 JSON.
4. Start with simple spur gear trains before advanced gear types.
5. Use a clean technical UI inspired by a white engineering canvas, light grid, and red accent #ff0000.
6. Do not implement full CAD or STEP yet. Build the foundation first.

First task:
Create the initial project structure, app shell, design tokens, Zustand state, URL serialization, and placeholder SVG canvas with two editable simple preview gears.
```

---

## 15. Segundo prompt recomendado después del app shell

```txt
Now implement the core math layer for the Simple Gear Train mode.
Create src/core/gearMath.ts and src/core/gearRatios.ts with pure functions for module-based spur gears.
Add tests for pitch diameter, outer diameter, root diameter, base diameter, center distance, gear ratio, output RPM, and rotation direction.
Connect these functions to the UI side panel so changing input teeth, output teeth, module, pressure angle, or input RPM updates ratio, center distance, and output RPM live.
```

---

## 16. Tercer prompt recomendado

```txt
Implement a simplified SVG gear renderer.
Create src/geometry/simplePreviewGear.ts that generates a gear-like polygon using alternating inner and outer radii.
Render two gears with sizes proportional to module * teeth.
Position them automatically using the calculated center distance.
Add center dots, optional pitch circles, and a small ratio label.
Keep the renderer independent from the final involute geometry.
```

---

## 17. Cuarto prompt recomendado

```txt
Implement real involute spur gear 2D geometry.
Create src/geometry/involute.ts and src/geometry/spurGear2D.ts.
Generate arrays of points and an SVG path string for a closed involute gear outline using teeth, module, pressure angle, bore diameter, and quality.
Add a toggle in the UI to switch between simplified preview geometry and involute geometry.
Add tests or snapshot fixtures for generated geometry bounds and point counts.
```

---

## 18. Quinta tarea recomendada

```txt
Implement SVG export for the current design.
The exported SVG must use millimeters, correct viewBox, cut paths, bore holes, optional construction layers, and metadata comments containing the gear parameters.
Add an Export button menu with Export JSON and Export SVG options.
```

---

## 19. Decisión importante de alcance

No implementar todos estos tipos al principio:

```txt
Worm Gear
Helical Gear
Double Helical / Herringbone
Spiral Bevel Gear
Miter Gear
Straight Bevel Gear
```

Primero implementar bien:

```txt
Spur Gear
Internal Gear
Compound Gear Train
Planetary Gear Set
Rack and Pinion
```

Con esos cinco bloques, la herramienta ya será muy útil para mecatrónica.

---

## 20. Resultado esperado a largo plazo

Una herramienta web donde el usuario pueda:

1. Seleccionar tipo de transmisión.
2. Definir dientes, módulo, presión y unidades.
3. Ver la reducción total.
4. Ver RPM y sentido de giro.
5. Visualizar el sistema en 2D.
6. Compartir el diseño por URL.
7. Exportar SVG/DXF para corte láser.
8. Exportar STL para impresión 3D básica.
9. Generar scripts para FreeCAD/CadQuery y obtener STEP.
10. Usar presets de mecanismos comunes.

---

## 21. Comentario final de dirección

La forma correcta de construir este proyecto no es comenzar por el exportador más complejo. La forma correcta es construir primero un núcleo confiable:

```txt
datos → cálculo → visualización → exportación → manufactura
```

Si el núcleo matemático y el modelo de datos están bien hechos, todo lo demás se puede construir por capas.

