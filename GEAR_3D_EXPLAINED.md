# Cómo funciona el sistema 3D de engranes y la exportación OBJ/STL

Este documento explica de punta a punta el flujo que convierte los parámetros de un engrane (número de dientes, módulo, presión angular, etc.) en una malla 3D que se renderiza en pantalla y se puede descargar como STL u OBJ.

---

## Mapa del flujo completo

```
Parámetros del engrane
        │
        ▼
  [involute.ts]          ← matemática pura: función involuta del círculo
        │
        ▼
  [spurGear2D.ts]        ← perfil 2D completo: N puntos (x, y) en mm
        │
        ├──────────────────────────────────────────────────┐
        ▼                                                  ▼
  [GearCanvas3D.tsx]                               [meshExport.ts]
  Three.js ExtrudeGeometry                         Triangulación manual
  → renderizado en tiempo real                     → STL / OBJ para descarga
```

---

## 1. La curva involuta (`src/geometry/involute.ts`)

El perfil de un diente de engrane no es un arco de círculo: es una **involuta de círculo** — la curva que traza el extremo de un hilo enrollado alrededor de un cilindro (el "círculo base") cuando se desenrolla.

### Ecuación paramétrica

```ts
// involute.ts:14
export function involutePoint(rb: number, t: number): Point2D {
  return {
    x: rb * (Math.cos(t) + t * Math.sin(t)),
    y: rb * (Math.sin(t) - t * Math.cos(t)),
  };
}
```

- `rb` = radio del círculo base (`pitchRadius × cos(pressureAngle)`)
- `t` = parámetro de "cuánto se ha desenrollado" (ángulo en radianes)
- A `t = 0` el punto está sobre el círculo base; a mayor `t` se aleja radialmente

Para saber en qué `t` la involuta toca un círculo de radio `r` (p. ej. el círculo exterior):

```ts
// involute.ts:22
export function involuteParamForRadius(rb: number, r: number): number {
  if (r <= rb) return 0;
  return Math.sqrt((r / rb) ** 2 - 1);
}
```

Esto viene de que `r(t) = rb × √(1 + t²)`.

Finalmente, `involuteFlankPoints` genera N+1 puntos equiespaciados a lo largo de un flanco:

```ts
// involute.ts:40
export function involuteFlankPoints(
  baseR: number, startR: number, endR: number, steps: number
): Point2D[] {
  const tStart = involuteParamForRadius(baseR, Math.max(baseR, startR));
  const tEnd   = involuteParamForRadius(baseR, endR);
  // interpolación lineal en el parámetro t
  for (let i = 0; i <= steps; i++) {
    const t = tStart + (tEnd - tStart) * (i / steps);
    pts.push(involutePoint(baseR, t));
  }
}
```

---

## 2. Perfil 2D del engrane (`src/geometry/spurGear2D.ts`)

`generateSpurGearOutline` toma los parámetros y devuelve el array de puntos `{x, y}` que forman el contorno completo del engrane. Este contorno es la base de **todo lo demás** (render 3D, exportación, previsualización 2D).

### Radios clave

```ts
// spurGear2D.ts:43
const pitchR = m * z / 2;           // radio primitivo
const outerR = pitchR + m;          // adendo = 1×módulo
const rootR  = pitchR - 1.25 * m;  // dedendo = 1.25×módulo
const baseR  = pitchR * Math.cos(pa); // radio base (involuta sale de aquí)
```

### Construcción diente por diente

Para cada uno de los `z` dientes:

1. **Flanco derecho (involuta):** se genera con `involuteFlankPoints` y se rota a su posición angular.
2. **Flanco izquierdo:** es el flanco derecho espejado en X y recorrido en sentido contrario.
3. **Arco de raíz:** un arco circular en `rootR` que conecta el flanco izquierdo del diente actual con el flanco derecho del siguiente.

```ts
// spurGear2D.ts:80
for (let i = 0; i < z; i++) {
  const θ = i * pitchAngle;          // ángulo del centro de este diente

  rightFlank.forEach(p => allPts.push(rotatePoint(p, θ)));  // flanco derecho
  leftFlank.forEach(p  => allPts.push(rotatePoint(p, θ)));  // flanco izquierdo

  // arco de raíz hacia el siguiente diente
  allPts.push(...arcPoints(rootR, arcStart, arcEnd, 3));
}
```

El resultado es una polilínea cerrada de ~`(quality×2 + 4) × z` puntos en sentido **antihorario** (CCW), en coordenadas de matemáticas (Y hacia arriba).

---

## 3. Renderizado 3D en tiempo real (`src/ui/components/GearCanvas3D.tsx`)

### Carga diferida de Three.js

Three.js es pesado (~600 KB). Se importa **dinámicamente** para no bloquear el bundle inicial:

```ts
// GearCanvas3D.tsx:103
const THREE = await import('three');
```

Esto garantiza que la carga inicial de la página sea rápida.

### De polilínea 2D a sólido 3D: `ExtrudeGeometry`

Three.js tiene una primitiva `ExtrudeGeometry` que toma un `Shape` (contorno 2D) y lo "extruye" a lo largo del eje Z:

```ts
// GearCanvas3D.tsx:25-41
function buildGearGeo(THREE, gear, moduleMm, pa) {
  // 1. Generar el contorno 2D
  const prof  = generateSpurGearOutline({ teeth: gear.teeth, moduleMm, pressureAngleDeg: pa });
  const shape = new THREE.Shape();
  prof.outline.forEach((p, i) =>
    i === 0 ? shape.moveTo(p.x, p.y) : shape.lineTo(p.x, p.y)
  );
  shape.closePath();

  // 2. Agregar el agujero del bore como "hole" en el Shape
  const hole = new THREE.Path();
  borePts.forEach((p, i) => { if (i === 0) hole.moveTo(p.x, p.y); else hole.lineTo(p.x, p.y); });
  shape.holes.push(hole);

  // 3. Extruir: profundidad = thicknessMm, sin bisel
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(gear.thicknessMm, 2),
    bevelEnabled: false,
    curveSegments: 12,
  });
  geo.center(); // centrar en el origen
  return geo;
}
```

Three.js se encarga de toda la triangulación automáticamente: las caras del frente, las del fondo y las paredes laterales.

### Escena y animación

```ts
// La escena tiene dos "pivots" (uno por engrane) centrados en el eje del par
const pivot1 = new THREE.Group(); // engrane de salida, a la izquierda
const pivot2 = new THREE.Group(); // engrane de entrada, a la derecha

// Se posicionan a ±centerDistance/2
pivot1.position.x = -cd / 2;
pivot2.position.x =  cd / 2;
```

Cada frame, los enganes giran respetando la relación de transmisión:

```ts
// GearCanvas3D.tsx:207-209
spinRef.current.s2 += OMEGA;                       // el engrane 2 gira constante
spinRef.current.s1 -= OMEGA * (z2 / z1);          // el engrane 1 gira en sentido contrario
                                                    // y a velocidad proporcional (ratio)
pivot1.rotation.z = spinRef.current.s1;
pivot2.rotation.z = spinRef.current.s2;
```

### Transición suave 2D ↔ 3D

La vista 2D y la 3D no son pantallas separadas: es **la misma escena** con la cámara y la escala animadas. El parámetro `progress` (0 = 2D, 1 = 3D) controla todo:

```ts
// GearCanvas3D.tsx:184-191
// Posición de la cámara: lerp entre vista frontal (2D) y vista isométrica (3D)
camera.position.set(0,
  lerp(0, ISO_Y * id, p),     // sube desde Y=0
  lerp(fd, ISO_Z * id, p)     // se acerca al plano
);
camera.fov = lerp(FRONT_FOV, ISO_FOV, p); // 18° (2D) → 34° (3D)

// Escala en Z: 0.003 = prácticamente plano (2D), 1.0 = grosor real (3D)
group.scale.set(sc, sc, sc * lerp(0.003, 1.0, p));
```

El grid también rota de "pared de fondo" en 2D a "piso" en 3D, y el arrastre con el ratón solo funciona en modo 3D.

---

## 4. Exportación a STL y OBJ (`src/exporters/meshExport.ts`)

Para exportar **no se usa Three.js**. Se construye la malla manualmente con triángulos para tener control total sobre los normales, la hermeticidad y el formato. El módulo solo depende de `spurGear2D.ts`.

### `buildTriangles`: armado de la malla completa

```ts
// meshExport.ts:114
function buildTriangles(p: GearMeshParams): Tri[] {
  const geo   = generateSpurGearOutline({ ...p, quality });
  const outer = geo.outline.map(pt => [pt.x, pt.y] as XY);  // N puntos del perfil
  const inner = circleXY(boreR, M_BORE);                     // 64 puntos del agujero
  // ...
}
```

La malla se divide en **cuatro zonas**:

#### Zona 1: Pared exterior (flancos de los dientes)

Cada segmento consecutivo del perfil 2D genera un **quad** (dos triángulos):

```ts
// meshExport.ts:130-135
for (let i = 0; i < N; i++) {
  const j = (i + 1) % N;
  const [x0,y0] = outer[i], [x1,y1] = outer[j];
  tris.push([[x0,y0,0],    [x1,y1,0],    [x1,y1,thick]]);  // tri 1
  tris.push([[x0,y0,0],    [x1,y1,thick],[x0,y0,thick]]);  // tri 2
}
```

El orden CCW (antihorario visto desde afuera) hace que el normal apunte hacia afuera.

#### Zona 2: Pared interior del agujero (bore)

Idéntica lógica pero con el polígono del bore. El winding se invierte (CW) para que el normal apunte hacia el centro del agujero (hacia afuera del sólido):

```ts
// meshExport.ts:140-145
for (let i = 0; i < M_BORE; i++) {
  const j = (i + 1) % M_BORE;
  tris.push([[x0,y0,0], [x1,y1,thick], [x1,y1,0]]);     // invertido vs. exterior
  tris.push([[x0,y0,0], [x0,y0,thick], [x1,y1,thick]]);
}
```

#### Zonas 3 y 4: Tapas (frente z=0 y fondo z=thickness)

La tapa es el área anular entre el perfil exterior y el círculo del bore. Es la parte más compleja porque hay que triangular esta región sin dejar huecos ni duplicar aristas.

Se usa el **algoritmo Zipper** (`zipperCap`):

```
Idea: recorre ambas polilíneas (exterior e interior) en paralelo,
avanzando siempre por la que "le toca" angularmente.
Cada paso genera un triángulo, sin saltos ni huecos.

exterior[oi] ──── exterior[oi+1]
     │     ╲
     │       ╲    ← tri A: avanza por exterior
     │         ╲
interior[ii] ── interior[ii+1]
     │     ╲
     │       ╲    ← tri B: avanza por interior
     │         ╲
```

```ts
// meshExport.ts:91-107
for (let step = 0; step < N + M; step++) {
  const nextOuterA = outerCum[oi + 1];   // ángulo acumulado del próximo punto exterior
  const nextInnerA = (ii + 1) * iStep;  // ángulo del próximo punto interior

  if (nextOuterA <= nextInnerA) {
    push(oA, oB, iA);   // avanza por el exterior
    oi++;
  } else {
    push(oA, iB, iA);   // avanza por el interior
    ii++;
  }
}
```

El algoritmo produce exactamente `N + M` triángulos por tapa, con cada arista apareciendo en exactamente un triángulo → malla **2-manifold** (watertight, lista para imprimir).

---

## 5. Formato STL ASCII

```ts
// meshExport.ts:156-175
export function exportGearStl(params: GearMeshParams, label = 'gear'): string {
  const tris = buildTriangles(params);
  const lines = [`solid ${label}`];
  for (const t of tris) {
    const n = triNormal(t);      // normal = producto cruzado de dos aristas
    lines.push(
      `  facet normal ${n[0]} ${n[1]} ${n[2]}`,
      `    outer loop`,
      `      vertex ${t[0][0]} ${t[0][1]} ${t[0][2]}`,
      `      vertex ${t[1][0]} ${t[1][1]} ${t[1][2]}`,
      `      vertex ${t[2][0]} ${t[2][1]} ${t[2][2]}`,
      `    endloop`,
      `  endfacet`,
    );
  }
  lines.push(`endsolid ${label}`);
  return lines.join('\n');
}
```

Cada triángulo en STL ASCII tiene su propio `facet normal` calculado desde los vértices (producto cruzado normalizado). Las unidades son **milímetros directamente** — el modelo no necesita escala al importarse en un slicer 3D.

---

## 6. Formato OBJ con normales suavizadas

OBJ es más eficiente que STL porque **deduplica vértices**: varios triángulos que comparten un vértice lo referencian por índice en vez de repetir sus coordenadas.

Además, OBJ permite **normales por vértice** (suavizadas), lo que hace que el modelo se vea más pulido en renders aunque la geometría sea la misma:

```ts
// meshExport.ts:199-213
// Acumular normales de todos los triángulos que usan cada vértice
const vnAccum: [number,number,number][] = verts.map(() => [0, 0, 0]);
for (let fi = 0; fi < faces.length; fi++) {
  const n = triNormal(tris[fi]);
  for (const vi of [a, b, c]) {
    vnAccum[vi][0] += n[0];   // suma de normales de cara
    vnAccum[vi][1] += n[1];
    vnAccum[vi][2] += n[2];
  }
}
// Normalizar = promedio ponderado de las normales de cara vecinas
const vnNorm = vnAccum.map(v => normalize(v));
```

El archivo OBJ resultante tiene este formato:

```
# Gear — teeth:18 module:2mm PA:20°
o Input-Gear

v  10.00000  0.00000  0.00000    ← vértices
v  9.98123  0.19122  0.00000
...

vn  1.00000  0.00000  0.00000    ← normales por vértice
vn  0.99812  0.06123  0.00000
...

f 1//1 2//2 3//3                 ← caras: índice_vértice//índice_normal
f 1//1 3//3 4//4
```

---

## 7. Pipeline de descarga

```
Usuario hace clic en "Export STL"
        │
        ▼
  ExportModal.handleExport()
        │
        ├── exportGearStl(params)   ← meshExport.ts: genera el string STL
        │
        ▼
  downloadStl(content, filename)   ← download.ts: Blob → <a download> → click
```

```ts
// download.ts
export function downloadTextFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
```

El truco es crear un `<a>` virtual con `download` y hacer click programático — no requiere servidor.

---

## 8. Diferencias clave STL vs OBJ

| Aspecto | STL ASCII | OBJ |
|---|---|---|
| Vértices | Repetidos en cada triángulo | Deduplicados, referenciados por índice |
| Normales | Una por triángulo (flat shading) | Una por vértice (smooth shading) |
| Tamaño archivo | ~3× más grande | Más compacto |
| Compatibilidad | Universal (slicers, CAD) | Render 3D, Blender, CAD |
| Metadata | Solo el nombre del sólido | Comentarios con parámetros del engrane |

---

## 9. Cómo la vista 3D y la exportación difieren

| | Three.js (`GearCanvas3D.tsx`) | Exportación (`meshExport.ts`) |
|---|---|---|
| Propósito | Render en tiempo real | Archivo descargable |
| Triangulación | `ExtrudeGeometry` (automática) | Manual, zipper algorithm |
| Normales | Calculadas por la GPU | Calculadas explícitamente |
| Bore | Como `Shape.holes` | Como polígono de `M_BORE = 64` puntos |
| Animación | Sí (spin, transición 2D↔3D) | No aplica |
| Dependencia | Three.js (dynamic import) | Solo `spurGear2D.ts` |

La exportación no captura lo que se ve en pantalla: regenera la malla desde cero con mayor calidad de involuta (`quality = 24` vs `quality = 8` en preview).

---

## 10. Tipos de bore soportados

El agujero central puede tener tres formas (`src/geometry/borePath.ts`):

- **`round`** — círculo simple de 36 vértices
- **`d-shaft`** — círculo con una cuerda plana (~290° de arco + segmento recto)
- **`keyway`** — círculo con ranura rectangular en la parte superior (para clavija)

El contorno CCW generado se usa tanto como `Shape.holes` en Three.js como polígono de la pared interior en la exportación.
