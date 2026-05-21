# Cómo se dibuja el Simple Gear Train — 2D y 3D

Referencia técnica completa para replicar y variar la estética visual.

---

## Índice

1. [Fondo de matriz (2D)](#1-fondo-de-matriz-2d)
2. [Perfil del diente (involuta)](#2-perfil-del-diente-involuta)
3. [Layout de los dos engranes](#3-layout-de-los-dos-engranes)
4. [Elementos visuales dentro del SVG](#4-elementos-visuales-dentro-del-svg)
5. [Animación de giro (2D)](#5-animación-de-giro-2d)
6. [Anotaciones de ratio y módulo](#6-anotaciones-de-ratio-y-módulo)
7. [Vista 3D — estructura general](#7-vista-3d--estructura-general)
8. [Geometría 3D (extrusión)](#8-geometría-3d-extrusión)
9. [Grid en perspectiva (fondo 3D)](#9-grid-en-perspectiva-fondo-3d)
10. [Materiales y estilo visual 3D](#10-materiales-y-estilo-visual-3d)
11. [Animación de giro (3D)](#11-animación-de-giro-3d)
12. [Órbita automática y drag](#12-órbita-automática-y-drag)
13. [Tabla de valores clave para variaciones](#13-tabla-de-valores-clave-para-variaciones)

---

## 1. Fondo de matriz (2D)

**Archivo:** `src/styles/global.css` — selector `.app` y `.app::after`

El fondo tiene **dos capas de grilla** superpuestas sobre el color base de la app.

### Capa fina (sobre todo el viewport)

```css
.app {
  background:
    linear-gradient(var(--grid-fine) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-fine) 1px, transparent 1px),
    var(--bg);
  background-size: 24px 24px;
}
```

- Color de líneas: `--grid-fine: #eef0f3` (gris muy claro, casi invisible)
- Espaciado: **24×24 px** (cuadrícula densa)
- Técnica: dos `linear-gradient` de 1px de grosor, uno horizontal y uno vertical, sobre el color de fondo `--bg: #fafbfc`

### Capa gruesa + glow rojo (solo en el área del canvas)

```css
.app::after {
  content: ""; position: absolute; inset: 86px 0 0 0; /* debajo del topbar */
  pointer-events: none; z-index: 0;
  background:
    linear-gradient(var(--grid-major) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-major) 1px, transparent 1px),
    radial-gradient(ellipse 800px 500px at 60% 50%,
      rgba(230, 0, 35, 0.025), transparent 70%);
  background-size: 120px 120px, 120px 120px, 100% 100%;
}
```

- Color de líneas: `--grid-major: #e2e5ea` (ligeramente más oscuras)
- Espaciado: **120×120 px** (cuadrícula de 5×5 celdas finas = una celda gruesa)
- Glow rojo: elipse radial centrada al 60% horizontal, muy transparente (`0.025` alpha), radio 800×500px
- El `::after` empieza en `inset: 86px 0 0 0` para no tapar el topbar

### Resultado visual

La superposición de ambas grillas crea una apariencia de papel milimetrado técnico: cuadros pequeños con refuerzo cada 5, igual que papel de ingeniería. El glow rojo sutil da calidez al área del canvas sin distraer.

---

## 2. Perfil del diente (involuta)

**Archivos:** `src/geometry/involute.ts` + `src/geometry/spurGear2D.ts` + `src/geometry/polar.ts`

El perfil real de un engrane usa la **curva involuta de círculo**. No son trapezoides ni arcos simples.

### Matemática de la involuta

```
involutePoint(rb, t):
  x = rb * (cos(t) + t * sin(t))
  y = rb * (sin(t) - t * cos(t))
```

- `rb` = radio base = `pitchRadius * cos(pressureAngle)`
- `t` = parámetro que va de 0 (en el círculo base) hacia afuera

El parámetro `t` correspondiente a un radio `r` dado es:

```
t = sqrt((r/rb)² - 1)
```

### Proceso de construcción de un diente

`generateSpurGearOutline()` en `spurGear2D.ts`:

1. **Calcula radios** (en mm):
   - `pitchR = module * teeth / 2`
   - `outerR = pitchR + module` (adendo = 1×módulo)
   - `rootR = pitchR - 1.25 * module` (dedendo = 1.25×módulo)
   - `baseR = pitchR * cos(pressureAngle)`

2. **Genera un flanco derecho** (involuta desde `max(baseR, rootR)` hasta `outerR`, en 8 pasos por defecto)

3. **Genera flanco izquierdo** = espejo en Y del flanco derecho, invertido (para que el path sea continuo CCW)

4. **Posiciona el diente** usando `flankPhase`: rotación que centra el diente en el eje +X

5. **Repite para todos los dientes** con `rotatePoint(p, i * pitchAngle)`

6. **Entre dientes**: arco de raíz (`arcPoints`) que conecta el flanco izquierdo de un diente con el flanco derecho del siguiente

### Sistema de coordenadas

Todo el cálculo es en **coordenadas matemáticas (Y hacia arriba)**. La conversión a SVG (Y hacia abajo) ocurre solo al renderizar en `toLocalSvgPath()`:

```ts
// polar.ts
toLocalSvgPath(points, scale):
  svgPts = points.map(p => ({ x: p.x * scale, y: -p.y * scale }))
```

El path local resultante se coloca dentro de un `<g transform="translate(cx, cy)">` para no hardcodear coordenadas absolutas en el path.

---

## 3. Layout de los dos engranes

**Archivo:** `src/geometry/simplePreviewGear.ts` — función `layoutTwoGears()`

El layout es completamente automático: calcula posiciones y escala para que los dos engranes **siempre encajen en el viewBox** con margen fijo.

### Parámetros fijos

```ts
const SVG_W = 620, SVG_H = 420;   // GearCanvas.tsx
const LAYOUT_ANGLE_DEG = 215;      // simplePreviewGear.ts
```

- El engrane grande (g1, output) se ancla en el origen del espacio mm
- El engrane pequeño (g2, input) se desplaza a 215° (abajo-izquierda)

### Algoritmo

```
1. Calcular distancia de centro: cd = (m*z1 + m*z2) / 2  [mm]
2. Posición relativa g2:
     cdx = cd * cos(215°)   → negativo (izquierda)
     cdy = cd * sin(215°)   → positivo (abajo en SVG)
3. Bounding box de ambos engranes (usando outerRadius)
4. svgScale = min(
     (SVG_W - 2*margin) / (maxX - minX),
     (SVG_H - 2*margin) / (maxY - minY)
   )
5. Centrar resultado en viewBox:
     cx1 = (SVG_W - span*scale)/2 - minX*scale
     cy1 = (SVG_H - span*scale)/2 - minY*scale
     cx2 = cx1 + cdx * scale
     cy2 = cy1 + cdy * scale
```

El `svgScale` resultante convierte mm a píxeles SVG. Este mismo valor se usa para escalar todos los radios al dibujar los elementos decorativos.

---

## 4. Elementos visuales dentro del SVG

**Archivo:** `src/ui/components/GearCanvas.tsx` — componente `AnimatedSimpleGear`

El SVG tiene `viewBox="0 0 620 420"` y contiene estos elementos en orden (de fondo a frente):

### 4.1 Línea de centros (ejes)

```tsx
<line x1={cx2} y1={cy2} x2={cx1} y2={cy1}
  stroke="var(--text-muted)" strokeWidth={1}
  strokeDasharray="4 4" opacity={0.4} />
```

- Línea de trazos entre los dos centros
- Color: `--text-muted: #9aa0a6`
- Opacidad: `0.4`

### 4.2 Círculos de paso (pitch circles)

Dibujados en el mismo `<g>` de cada engrane, antes del path de los dientes:

```tsx
<circle r={px(geo.pitchRadius)}
  fill="none" stroke="var(--red)" strokeWidth={0.75}
  strokeDasharray="3 4" opacity={0.35} />
```

- Radio: `pitchRadius * svgScale` px
- Trazo rojo `--red: #e60023`, muy transparente (`0.35`)
- Marca visualmente el círculo primitivo sobre el que "ruedan" los engranes

### 4.3 Body del engrane (path involuta)

```tsx
<path d={localPath}
  fill="var(--white)" stroke="var(--black)"
  strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
```

- Relleno: blanco puro `--white: #ffffff`
- Stroke: negro casi puro `--black: #0a0c0f`
- `strokeWidth: 1.5` px
- Esquinas suavizadas: `strokeLinejoin="round"` + `strokeLinecap="round"`

### 4.4 Punto central (eje de rotación)

```tsx
<circle r={3.5} fill="var(--red)" />
```

- Radio fijo: **3.5 px** (no escala con el engrane)
- Color rojo sólido
- Siempre en la posición (0,0) del `<g translate(cx,cy)>`

### 4.5 Modo debug (círculos de referencia)

Solo visible cuando `debug=true`. Muestra tres círculos de línea discontinua por cada engrane:

```tsx
<circle r={px(geo.rootRadius)}  stroke="#94a3b8" strokeDasharray="4 3" />   // raíz — gris claro
<circle r={px(geo.outerRadius)} stroke="#64748b" strokeDasharray="4 3" />   // exterior — gris
<circle r={px(geo.baseRadius)}  stroke="#60a5fa" strokeDasharray="3 3" />   // base — azul
```

Todos con `opacity={0.55}` y `strokeWidth={0.75}`.

### 4.6 DimensionOverlay (si showRuler=true)

`src/ui/svg/DimensionOverlay.tsx` — superpone:
- Cotas de diámetro exterior de cada engrane (líneas con flechas y texto en JetBrains Mono 11px)
- Cota de distancia entre centros (línea paralela al eje de centros, con texto rotado)
- Color de diámetros: `var(--red)`, color de distancia: `#475569`

### 4.7 ScaleBar

`src/ui/svg/ScaleBar.tsx` — esquina inferior derecha del SVG:
- Barra horizontal en `var(--red)`, `strokeWidth=1.5`
- Ticks verticales en los extremos
- Texto con la medida real (mm o pulgadas) en JetBrains Mono 9px

---

## 5. Animación de giro (2D)

**Archivo:** `src/ui/components/GearCanvas.tsx` — `useEffect` de animación

### Velocidad angular

```ts
const OMEGA = (2 * Math.PI) / 18;  // rad/segundo → 1 vuelta cada 18s
```

### Fase inicial (engranes encastrados)

`calculateExternalGearInitialPhase()` en `src/geometry/meshing.ts` calcula el ángulo inicial para que los dientes encajen al comenzar:

- **Driver (g2):** diente 0 apunta hacia el centro del engrane conducido → `rotation = meshAngleRad`
- **Driven (g1):** valle 0 apunta hacia el centro del driver → `rotation = meshAngleRad + π - pitchAngle/2`
- `meshAngle = atan2(-(cy1-cy2), cx1-cx2)` — ángulo del vector entre centros

### Loop de animación (requestAnimationFrame)

```ts
const frame = (now: DOMHighResTimeStamp) => {
  const delta = ((now - t0) / 1000) * OMEGA;  // rad acumulados

  // Driver (g2): gira en sentido CW en pantalla (ángulo SVG decrece)
  g2Ref.current?.setAttribute('transform', `rotate(${svgDeg(driverInit - delta)})`);

  // Driven (g1): contra-gira, escalado por ratio z2/z1
  g1Ref.current?.setAttribute('transform', `rotate(${svgDeg(drivenInit + delta * (z2 / z1))})`);
};
```

La conversión de radianes matemáticos a grados SVG es:

```ts
svgDeg(rad) = -(rad * 180/π)
```

El signo negativo porque SVG tiene Y hacia abajo y el eje de rotación positivo en SVG es CW (al revés que matemáticas).

### Estructura del SVG para la rotación

```
<g transform="translate(cx, cy)">          ← posicionamiento fijo
  <circle r={pitchR} />                    ← círculo de paso (no rota)
  <g ref={gearRef} transform="rotate(θ)"> ← ESTE rota
    <path d={localPath} />                 ← dientes
  </g>
  <circle r={3.5} />                       ← punto central (no rota)
</g>
```

Solo el `<g>` interior rota. La traslación y el punto central permanecen fijos. La animación modifica el atributo `transform` del `<g>` interior directamente (no a través de estado React) para máximo rendimiento.

---

## 6. Anotaciones de ratio y módulo

**Archivo:** `src/ui/components/GearCanvas.tsx` — dentro de `GearCanvas` (fuera del SVG)

Son `<div>` HTML posicionados sobre el canvas con `position: absolute`:

```tsx
<div className="stage-annotation ann-tl">   {/* arriba-centro-izq */}
  <span className="ann-dot" />              {/* punto rojo */}
  <span className="ann-label">Ratio</span>
  <span className="ann-value">3.0 : 1</span>
</div>

<div className="stage-annotation ann-br">   {/* abajo-centro-der */}
  <span className="ann-dot" style={{ background: 'var(--text-strong)' }} />
  <span className="ann-label">Module</span>
  <span className="ann-value">2 mm</span>
</div>
```

Estilos CSS:

```css
.stage-annotation {
  font-family: var(--font-mono); font-size: 10px;
  letter-spacing: 0.06em; text-transform: uppercase;
  background: var(--white); border: 1px solid var(--border);
  padding: 6px 10px; border-radius: 8px;
  box-shadow: var(--shadow-soft);
  display: flex; align-items: center; gap: 6px;
}
.ann-tl { top: 32px; left: 50%; transform: translateX(-180px); }
.ann-br { bottom: 32px; left: 50%; transform: translateX(60px); }
```

---

## 7. Vista 3D — estructura general

**Archivo:** `src/ui/components/GearCanvas3D.tsx`

Three.js se carga de forma **dinámica** (`await import('three')`) para no inflar el bundle inicial. El componente monta un `<canvas>` nativo y Three.js renderiza sobre él.

### Jerarquía de objetos en la escena

```
Scene
├── group (Group)             ← rotación orbital (drag + auto-giro)
│   ├── pivot1 (Group)        ← posición y giro del engrane 1 (g1, large)
│   │   ├── fill1 (Mesh)      ← cara blanca sólida
│   │   └── lines1 (LineSegments) ← aristas rojas
│   └── pivot2 (Group)        ← posición y giro del engrane 2 (g2, small)
│       ├── fill2 (Mesh)
│       └── lines2 (LineSegments)
└── grid (GridHelper)         ← cuadrícula de fondo (fuera del group, no rota)
```

### Escala de la escena

```ts
const R1_mm = (g1.teeth * moduleMm) / 2;   // radio de paso g1 en mm
const SC    = 3.5 / R1_mm;                  // escala: radio g1 → 3.5 unidades Three.js
```

El `group.scale.setScalar(SC)` aplica esta escala a toda la geometría. Así la cámara siempre ve los engranes de tamaño similar sin importar el módulo o número de dientes.

### Posición de los pivots

```ts
pivot1.position.x = -cd / 2;   // g1 a la izquierda del centro
pivot2.position.x =  cd / 2;   // g2 a la derecha del centro
```

Donde `cd = (z1 + z2) * module / 2` es la distancia de centros en mm (antes de aplicar SC).

---

## 8. Geometría 3D (extrusión)

**Función:** `buildGearGeo()` en `GearCanvas3D.tsx`

### Proceso

1. **Obtener el outline 2D** del engrane (misma función que 2D): `generateSpurGearOutline()`

2. **Crear THREE.Shape** a partir de los puntos del outline:

```ts
const shape = new THREE.Shape();
prof.outline.forEach((p, i) =>
  i === 0 ? shape.moveTo(p.x, p.y) : shape.lineTo(p.x, p.y)
);
shape.closePath();
```

3. **Agujero central (bore)**: círculo de 32 segmentos con radio proporcional:

```ts
const boreR = Math.max(prof.rootRadius * 0.28, moduleMm);
// se crea como THREE.Path y se agrega: shape.holes.push(hole)
```

4. **Extruir** con `THREE.ExtrudeGeometry`:

```ts
new THREE.ExtrudeGeometry(shape, {
  depth:        Math.max(gear.thicknessMm, R1_mm * 0.4),
  bevelEnabled: false,    // sin chaflán
  curveSegments: 12,      // suavidad de curvas
})
```

5. **Reorientar**:
   - `geo.center()` — centrar en el origen del grupo
   - `geo.rotateX(-Math.PI / 2)` — el Shape está en XY, rotarlo para que quede en XZ (horizontal)

6. **Aristas** para el estilo wireframe:

```ts
const edgesGeo = new THREE.EdgesGeometry(geo, 12);
// 12 = ángulo mínimo entre caras para dibujar una arista (grados)
```

---

## 9. Grid en perspectiva (fondo 3D)

**Dentro de** `GearCanvas3D.tsx`

```ts
const GRID = 0xf2c8cc;   // rosa claro (rojo muy desaturado)

const grid = new THREE.GridHelper(40, 30, GRID, GRID);
```

- **Tamaño total:** 40 unidades Three.js de lado
- **Divisiones:** 30×30 celdas
- **Color de líneas centrales:** `0xf2c8cc` (mismo que celdas, sin distinción)
- **Transparencia:** `opacity: 0.65`, `transparent: true`

### Posición vertical del grid

Se recalcula en `rebuildGears()` en función del tamaño visible:

```ts
const bound = fitCamera(...);            // radio visible aproximado
grid.position.y = -(bound * 1.1);        // justo debajo de los engranes
```

El grid **no está dentro del `group`**, por lo que no rota con la órbita. Siempre permanece horizontal, lo que da el efecto de "suelo" o "plano de referencia".

### Cámara perspectiva

```ts
const camera = new THREE.PerspectiveCamera(35, w/h, 0.1, 5000);
```

- **FOV:** 35° (ángulo estrecho → poca distorsión perspectiva, look técnico)
- Posición inicial: vector `(9, 6.5, 11)` normalizado y escalado → vista desde arriba-derecha

```ts
function fitCamera(...) {
  const cd     = (g1.teeth + g2.teeth) * moduleMm / 2;
  const bound  = (cd / 2 + R1_outer) * SC;
  const dist   = (bound / sin(17.5°)) * 1.35;   // 17.5 = FOV/2
  camera.position = normalize(9, 6.5, 11) * dist;
  camera.lookAt(0, 0, 0);
}
```

---

## 10. Materiales y estilo visual 3D

El look es **wireframe sobre sólido blanco** — no hay iluminación, todo es flat.

### Fill (sólido blanco)

```ts
new THREE.MeshBasicMaterial({
  color:               0xffffff,       // blanco puro
  side:                THREE.DoubleSide,
  polygonOffset:       true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits:  1,
})
```

`polygonOffset` evita el z-fighting entre las caras sólidas y las aristas que se dibujan encima.

### Lines (aristas rojas)

```ts
const RED = 0xc8202a;   // rojo más oscuro que --red (más apropiado en 3D)

new THREE.LineBasicMaterial({ color: RED })
```

Las aristas se crean con `EdgesGeometry` que filtra aristas por ángulo (12°). Solo aparecen las aristas donde hay un cambio de dirección significativo — los contornos del engrane y los bordes de la extrusión.

### Fondo del renderer

```ts
renderer.setClearColor(0xffffff, 1);   // fondo blanco sólido
```

No hay `fog`, no hay `AmbientLight`. La escena solo tiene geometría plana coloreada.

---

## 11. Animación de giro (3D)

En el loop de animación (`tick()`):

```ts
const OMEGA = 0.008;   // rad/frame

// g2 = driver, gira en sentido positivo Y
spinRef.current.s2 += OMEGA;

// g1 = driven, contra-gira escalado por el ratio
spinRef.current.s1 -= OMEGA * (z2 / z1);

pivot1.rotation.y = spinRef.current.s1;
pivot2.rotation.y = spinRef.current.s2;
```

- La rotación es sobre el eje Y local de cada pivot (los engranes son horizontales, eje de giro vertical)
- El ratio z2/z1 asegura sincronía: el engrane grande gira más lento si tiene más dientes

### Fase inicial 3D

```ts
spinRef.current = { s1: 0, s2: (g2.teeth - 1) * Math.PI / g2.teeth };
```

El offset inicial de `s2` intenta que los dientes arranquen aproximadamente encastrados, aunque en 3D es aproximado (no hay `calculateExternalGearInitialPhase` aquí).

---

## 12. Órbita automática y drag

```ts
let rotY = 0.4, rotX = 0.2;   // inclinación inicial (leve rotación diagonal)

// Cada frame sin drag:
if (!dragging) rotY += 0.005;   // giro orbital lento en Y

group.rotation.y = rotY;
group.rotation.x = rotX;
```

### Drag con pointer events

```ts
const onMove = (e: PointerEvent) => {
  if (!dragging) return;
  rotY += (e.clientX - lx) * 0.01;
  rotX += (e.clientY - ly) * 0.01;
  rotX = clamp(rotX, -60°, 60°);   // límite en X para no dar la vuelta
};
```

- **Sensibilidad:** `0.01 rad/px`
- **Límite X:** ±π/3 (±60°) — evita que el suelo quede encima
- El `canvas.setPointerCapture(e.pointerId)` mantiene el drag aunque el cursor salga del canvas

---

## 13. Tabla de valores clave para variaciones

| Elemento | Variable / constante | Valor actual | Dónde cambiarlo |
|---|---|---|---|
| Velocidad giro 2D | `OMEGA` | `2π/18` rad/s | `GearCanvas.tsx:19` |
| Velocidad giro 3D | `OMEGA` | `0.008` rad/frame | `GearCanvas3D.tsx:10` |
| Velocidad órbita 3D | `rotY += 0.005` | `0.005` | `GearCanvas3D.tsx:201` |
| Ángulo de layout | `LAYOUT_ANGLE_DEG` | `215°` | `simplePreviewGear.ts:76` |
| Tamaño SVG 2D | `SVG_W, SVG_H` | `620 × 420` | `GearCanvas.tsx:17` |
| Color stroke engrane | `--black` | `#0a0c0f` | `tokens.css` |
| Grosor stroke engrane | `strokeWidth` | `1.5 px` | `GearCanvas.tsx:85,93` |
| Fill engrane 2D | `fill="var(--white)"` | `#ffffff` | `GearCanvas.tsx:85,93` |
| Color círculo de paso | `var(--red)` + `opacity 0.35` | `#e60023` | `GearCanvas.tsx:83,91` |
| Punto central radio | `r={3.5}` | `3.5 px` | `GearCanvas.tsx:87,94` |
| Color punto central | `var(--red)` | `#e60023` | `GearCanvas.tsx:87,94` |
| Grid fine size | `background-size: 24px` | `24px` | `global.css:.app` |
| Grid major size | `background-size: 120px` | `120px` | `global.css:.app::after` |
| Color grid fine | `--grid-fine` | `#eef0f3` | `tokens.css` |
| Color grid major | `--grid-major` | `#e2e5ea` | `tokens.css` |
| Glow rojo alpha | `rgba(230,0,35, 0.025)` | `0.025` | `global.css:.app::after` |
| Fill 3D | `0xffffff` | blanco | `GearCanvas3D.tsx:97` |
| Aristas 3D | `RED = 0xc8202a` | rojo oscuro | `GearCanvas3D.tsx:8` |
| Grid 3D color | `GRID = 0xf2c8cc` | rosa claro | `GearCanvas3D.tsx:9` |
| Grid 3D tamaño | `GridHelper(40, 30, ...)` | `40u / 30 celdas` | `GearCanvas3D.tsx:161` |
| Grid 3D opacidad | `opacity: 0.65` | `0.65` | `GearCanvas3D.tsx:163` |
| Fondo renderer 3D | `setClearColor(0xffffff)` | blanco | `GearCanvas3D.tsx:141` |
| FOV cámara 3D | `PerspectiveCamera(35, ...)` | `35°` | `GearCanvas3D.tsx:145` |
| Escala escena 3D | `SC = 3.5 / R1_mm` | radio g1 → 3.5 u | `GearCanvas3D.tsx:75` |
| Grosor extrusión mínimo | `R1_mm * 0.4` | 40% del radio | `GearCanvas3D.tsx:77` |
| Bore ratio | `rootRadius * 0.28` | 28% del radio raíz | `GearCanvas3D.tsx:22` |
| Sensibilidad drag | `* 0.01` | `0.01 rad/px` | `GearCanvas3D.tsx:177,178` |
| Inclinación inicial 3D | `rotY=0.4, rotX=0.2` | ~23°, ~11° | `GearCanvas3D.tsx:172` |
