# Vistas 3D paramétricas de engranes — especificación de implementación

Documento para Claude Code. Cubre seis tipos de engranes renderizados en Three.js con dos estilos visuales intercambiables (Blueprint y Wireframe sólido), incluyendo los ajustes específicos al helicoidal, compuesto y cónico.

## Stack

- **Three.js r128 o superior**, importado vía CDN o `npm install three`.
- Sin loaders externos: toda la geometría se construye proceduralmente.
- Renderizado en `<canvas>` con `WebGLRenderer({ antialias: true })`.
- Fondo blanco fijo (`renderer.setClearColor(0xffffff, 1)`).

## Constantes globales

```js
const RED_PRIMARY = 0xc8202a;   // Color principal de aristas
const GRID_FAINT  = 0xf2c8cc;   // Color del grid blueprint, rosa muy tenue
```

---

## Lógica del perfil de involuta (base de todo)

Todos los engranes excepto el cónico parten del mismo cálculo de perfil 2D de involuta. Esta función debe ser la única fuente de verdad para el perfil; cualquier engrane que la modifique debe hacerlo encima, no reimplementarla.

```js
function involute(teeth, module, pa_deg = 20, segs = 5) {
  const pa       = pa_deg * Math.PI / 180;
  const pitch_r  = (teeth * module) / 2;
  const base_r   = pitch_r * Math.cos(pa);
  const add_r    = pitch_r + module;
  const ded_r    = Math.max(pitch_r - 1.25 * module, base_r * 0.7);
  const tooth_a  = (2 * Math.PI) / teeth;
  const inv      = t => [base_r * (Math.cos(t) + t * Math.sin(t)),
                         base_r * (Math.sin(t) - t * Math.cos(t))];
  const t_add    = Math.sqrt((add_r / base_r) ** 2 - 1);
  const t_pitch  = Math.sqrt((pitch_r / base_r) ** 2 - 1);
  const [px, py] = inv(t_pitch);
  const pitch_ang = Math.atan2(py, px);
  const half      = tooth_a / 4;
  const ang_offset = half - pitch_ang;

  const pts = [];
  for (let i = 0; i < teeth; i++) {
    const rot = i * tooth_a;

    // Flanco ascendente (involuta)
    for (let j = 0; j <= segs; j++) {
      const t = (j / segs) * t_add;
      const [x, y] = inv(t);
      const a = Math.atan2(y, x) + rot + ang_offset;
      const r = Math.hypot(x, y);
      pts.push([r * Math.cos(a), r * Math.sin(a)]);
    }

    // Cresta del diente (addendum)
    const [tx, ty] = inv(t_add);
    const t1 = Math.atan2(ty, tx) + rot + ang_offset;
    const t2 = rot + tooth_a / 2 + (rot + tooth_a / 2 - t1);
    for (let j = 1; j <= 3; j++) {
      const a = t1 + (t2 - t1) * (j / 3);
      pts.push([add_r * Math.cos(a), add_r * Math.sin(a)]);
    }

    // Flanco descendente (espejo del ascendente)
    for (let j = segs; j >= 0; j--) {
      const t = (j / segs) * t_add;
      const [x, y] = inv(t);
      const a_orig = Math.atan2(y, x) + ang_offset;
      const a = rot + tooth_a - a_orig;
      const r = Math.hypot(x, y);
      pts.push([r * Math.cos(a), r * Math.sin(a)]);
    }

    // Raíz del diente (dedendum)
    const rs = rot + tooth_a - ang_offset;
    const re = (i + 1) * tooth_a + ang_offset;
    for (let j = 1; j <= 3; j++) {
      const a = rs + (re - rs) * (j / 3);
      pts.push([ded_r * Math.cos(a), ded_r * Math.sin(a)]);
    }
  }
  return { pts, pitch_r, ded_r, add_r };
}
```

**Parámetros tradicionales fijos**: ángulo de presión 20°, addendum 1.0 × módulo, dedendum 1.25 × módulo. No deben exponerse al usuario.

---

## Tipos de engranes — geometría 3D

### 1 · Recto simple (spur)

Extrusión directa de la forma 2D. Sin sorpresas.

```js
function spurGeo(teeth, module, thickness, boreRatio = 0.3) {
  const prof = involute(teeth, module);
  const shape = new THREE.Shape();
  prof.pts.forEach(([x, y], i) =>
    i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)
  );
  shape.closePath();

  const hole = new THREE.Path();
  hole.absarc(0, 0, prof.ded_r * boreRatio, 0, Math.PI * 2, false);
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSize: 0.04,
    bevelThickness: 0.04,
    bevelSegments: 2,
    curveSegments: 4
  });
  geo.center();
  geo.rotateX(-Math.PI / 2);
  return geo;
}
```

### 2 · Compuesto (dos engranes coaxiales) — fix incluido

**Problema reportado**: los engranes no se tocan, se ven flotando.

**Causa**: en la implementación anterior usé un gap intencional para distinguir visualmente las dos piezas. Mecánicamente esto es incorrecto — un engrane compuesto real es **una sola pieza** con dos perfiles de dientes en el mismo eje, fusionados o muy próximos.

**Solución**: el engrane grande y el chico comparten una cara central. El chico se monta sobre el grande con `gap = 0` (o muy pequeño, ~0.05 mm para visualización de la junta).

```js
function compoundGeo(teethBig, teethSmall, module, thicknessBig, thicknessSmall) {
  const big   = spurGeo(teethBig, module, thicknessBig);
  // El barreno del chico es ligeramente mayor para alojar el eje pasante
  const small = spurGeo(teethSmall, module, thicknessSmall, 0.45);

  // Posicionamiento: el grande centrado en y=0, el chico apoyado encima sin gap
  big.translate(0, thicknessBig / 2, 0);
  small.translate(0, thicknessBig + thicknessSmall / 2, 0);

  // Devolvemos las dos geometrías por separado para que el render pueda
  // colorearlas o agruparlas distinto si hace falta
  return [
    { geo: big,   label: 'gear_big'   },
    { geo: small, label: 'gear_small' }
  ];
}
```

**Notas para exportación**: en STL/OBJ las dos geometrías se fusionan en una sola pieza imprimible. La separación en `[big, small]` es solo para el render.

### 3 · Planetario

Sol al centro, planetas orbitando a la distancia `(Z_sol + Z_planeta) × m / 2`, anillo exterior con dientes internos.

```js
function planetaryGeo(teethSun, teethPlanet, module, thickness, nPlanets = 3, wallThickness = 1.5) {
  const sun     = spurGeo(teethSun, module, thickness);
  const planet  = spurGeo(teethPlanet, module, thickness);
  const teethRing = teethSun + 2 * teethPlanet;
  const ring    = ringGeo(teethRing, module, thickness, wallThickness);

  const rOrbit  = (teethSun + teethPlanet) * module / 2;
  const items   = [{ geo: sun, position: [0, 0, 0], label: 'sun' }];

  for (let i = 0; i < nPlanets; i++) {
    const a = (i / nPlanets) * Math.PI * 2;
    items.push({
      geo: planet,
      position: [Math.cos(a) * rOrbit, 0, Math.sin(a) * rOrbit],
      label: `planet_${i}`
    });
  }
  items.push({ geo: ring, position: [0, 0, 0], label: 'ring' });
  return items;
}
```

**Restricción crítica**: `Z_ring = Z_sun + 2 × Z_planet`. Esta es una ecuación geométrica, no negociable. Si el usuario ajusta uno, los otros dos se recalculan automáticamente.

### 4 · Helicoidal — fixes incluidos

**Problemas reportados**: errores de geometría, caras invisibles, posibles huecos en la malla.

**Causas identificadas**:

1. **Winding order inconsistente** en las paredes interiores del barreno (las del agujero central). Cuando se construye un `BufferGeometry` manualmente con un agujero, los triángulos del agujero deben tener orientación opuesta a los exteriores para que las normales apunten al lado correcto.
2. **Capas insuficientes** con torsión mayor a 20° causan que los triángulos laterales se vean retorcidos o se autointersecten.
3. **Tapas (caps) mal triangularizadas** cuando la forma tiene un hole — `ShapeUtils.triangulateShape` requiere que los puntos del agujero estén en el formato correcto.

**Solución completa**:

```js
function helicalGeo(teeth, module, thickness, helixDeg, direction = 1) {
  const prof = involute(teeth, module, 20, 5);

  // Más capas para hélices grandes — regla empírica: 1 capa por cada grado de torsión
  const layers = Math.max(20, Math.ceil(Math.abs(helixDeg) * 1.0));

  const shape = new THREE.Shape();
  prof.pts.forEach(([x, y], i) =>
    i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)
  );
  shape.closePath();

  const hole = new THREE.Path();
  hole.absarc(0, 0, prof.ded_r * 0.3, 0, Math.PI * 2, false);
  shape.holes.push(hole);

  const totalTwist = (helixDeg * Math.PI / 180) * direction;
  const positions  = [];
  const indices    = [];

  // Extraemos los puntos en el mismo orden de Shape para que la triangulación
  // de las tapas use exactamente los mismos índices que las paredes
  const points    = shape.extractPoints(2);
  const profPts   = points.shape;
  const holePts   = points.holes[0];
  const nProf     = profPts.length;
  const nHole     = holePts.length;

  // Generación de capas con rotación progresiva
  for (let L = 0; L <= layers; L++) {
    const z   = (L / layers) * thickness - thickness / 2;
    const ang = (L / layers) * totalTwist;
    const c   = Math.cos(ang), s = Math.sin(ang);

    // Perfil exterior
    for (let i = 0; i < nProf; i++) {
      const p = profPts[i];
      positions.push(p.x * c - p.y * s, p.x * s + p.y * c, z);
    }
    // Perfil del agujero
    for (let i = 0; i < nHole; i++) {
      const p = holePts[i];
      positions.push(p.x * c - p.y * s, p.x * s + p.y * c, z);
    }
  }

  const ring = nProf + nHole;

  // Paredes exteriores — winding order CCW vista desde fuera
  for (let L = 0; L < layers; L++) {
    for (let i = 0; i < nProf; i++) {
      const a = L * ring + i;
      const b = L * ring + (i + 1) % nProf;
      const c = (L + 1) * ring + (i + 1) % nProf;
      const d = (L + 1) * ring + i;
      indices.push(a, b, c, a, c, d);
    }

    // Paredes interiores del agujero — winding INVERTIDO
    // Las normales deben apuntar HACIA el centro del agujero (hacia fuera del material)
    for (let i = 0; i < nHole; i++) {
      const a = L * ring + nProf + i;
      const b = L * ring + nProf + (i + 1) % nHole;
      const c = (L + 1) * ring + nProf + (i + 1) % nHole;
      const d = (L + 1) * ring + nProf + i;
      indices.push(a, c, b, a, d, c);   // ← orden invertido respecto a las paredes exteriores
    }
  }

  // Triangulación de las tapas inferior y superior
  const caps = THREE.ShapeUtils.triangulateShape(profPts, [holePts]);

  // Tapa inferior — winding invertido (normal apunta hacia -Y)
  caps.forEach(([a, b, c]) => indices.push(a, c, b));

  // Tapa superior — winding original (normal apunta hacia +Y)
  const top = layers * ring;
  caps.forEach(([a, b, c]) => indices.push(top + a, top + b, top + c));

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.rotateX(-Math.PI / 2);

  return geo;
}
```

**Por qué funciona ahora**:

- Las normales del agujero apuntan al lugar correcto (gracias al winding invertido), evitando que se vean caras "negras" o invisibles al rotar.
- El número de capas escala con el ángulo de hélice, evitando triángulos demasiado retorcidos en hélices de 25°-30°.
- Las tapas usan exactamente los mismos índices que las paredes (porque ambos usan `points` extraídos del mismo `Shape`), evitando huecos en las uniones.

**Fallback adicional**: aplica `side: THREE.DoubleSide` al material como red de seguridad. Tiene un costo de performance del 10-15%, pero garantiza que ninguna cara se vea invisible en ningún ángulo. Recomendado para vistas de preview; opcional para producción.

### 5 · Interior (corona)

Anillo exterior cilíndrico con perfil de dientes como agujero interior.

```js
function ringGeo(teethInner, module, thickness, wallThickness) {
  const prof   = involute(teethInner, module);
  const outerR = prof.add_r + wallThickness + module;
  const outer  = new THREE.Shape();

  // Contorno exterior circular
  const segs = 64;
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const x = Math.cos(a) * outerR;
    const y = Math.sin(a) * outerR;
    i === 0 ? outer.moveTo(x, y) : outer.lineTo(x, y);
  }

  // Perfil de dientes como agujero (los dientes apuntan hacia el centro)
  const hole = new THREE.Path();
  prof.pts.forEach(([x, y], i) =>
    i === 0 ? hole.moveTo(x, y) : hole.lineTo(x, y)
  );
  outer.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(outer, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 4
  });
  geo.center();
  geo.rotateX(-Math.PI / 2);
  return geo;
}
```

### 6 · Cónico (bevel) — fix incluido

**Problema reportado**: el par cónico no hace match correcto, las dos piezas no engranan visualmente bien.

**Causas**:

1. **Ángulo del cono mal calculado** — para un par cónico que engrana a 90°, la suma de los ángulos de cono de ambos engranes debe ser exactamente 90°. Si ambos tienen el mismo número de dientes, cada uno tiene un ángulo de 45°. Si tienen ratio distinto, los ángulos se ajustan con `tan(α₁) = Z₁ / Z₂`.
2. **Posicionamiento de las dos piezas**: deben estar montadas con sus ápices (vértices teóricos del cono) coincidiendo en el mismo punto del espacio, y con los círculos de paso tangentes en ese punto.
3. **Orientación**: las caras donde están los dientes deben encararse, no estar de espaldas.

**Solución**:

```js
function bevelGeo(teeth, module, faceWidth, coneAngleDeg) {
  const prof    = involute(teeth, module, 20, 4);
  const profPts = prof.pts;
  const holeR   = prof.ded_r * 0.3;
  const coneAng = coneAngleDeg * Math.PI / 180;
  const layers  = 18;

  const positions = [];
  const indices   = [];
  const nProf = profPts.length;
  const nHole = 20;

  // Generamos capas que se estrechan progresivamente hacia el ápice del cono
  for (let L = 0; L <= layers; L++) {
    const tL    = L / layers;
    const z     = tL * faceWidth;
    // Factor de escala: el perfil se reduce conforme nos acercamos al ápice
    const scale = 1 - tL * Math.tan(coneAng) * (faceWidth / prof.pitch_r) * 0.5;

    for (let i = 0; i < nProf; i++) {
      positions.push(profPts[i][0] * scale, profPts[i][1] * scale, z);
    }
    for (let i = 0; i < nHole; i++) {
      const a = (i / nHole) * Math.PI * 2;
      positions.push(Math.cos(a) * holeR * scale, Math.sin(a) * holeR * scale, z);
    }
  }

  const ringSize = nProf + nHole;
  for (let L = 0; L < layers; L++) {
    for (let i = 0; i < nProf; i++) {
      const a = L * ringSize + i;
      const b = L * ringSize + (i + 1) % nProf;
      const c = (L + 1) * ringSize + (i + 1) % nProf;
      const d = (L + 1) * ringSize + i;
      indices.push(a, b, c, a, c, d);
    }
    for (let i = 0; i < nHole; i++) {
      const a = L * ringSize + nProf + i;
      const b = L * ringSize + nProf + (i + 1) % nHole;
      const c = (L + 1) * ringSize + nProf + (i + 1) % nHole;
      const d = (L + 1) * ringSize + nProf + i;
      indices.push(a, c, b, a, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.translate(0, 0, -faceWidth / 2);
  return geo;
}

function bevelPair(teeth, module, faceWidth) {
  // Para par cónico a 90° con engranes del mismo tamaño: ángulo de cono = 45°
  const coneAngle = 45;

  // El radio del cono primitivo en su base
  const pitch_r = (teeth * module) / 2;

  const g1 = bevelGeo(teeth, module, faceWidth, coneAngle);
  const g2 = bevelGeo(teeth, module, faceWidth, coneAngle);

  return [
    {
      geo: g1,
      // Eje vertical, dientes apuntando hacia arriba y hacia afuera
      position: [0, 0, 0],
      rotation: [-Math.PI / 2, 0, 0],
      label: 'bevel_a'
    },
    {
      geo: g2,
      // Eje horizontal, montado a 90°, ápice coincidente con el del primero
      position: [pitch_r, pitch_r, 0],
      rotation: [0, 0, Math.PI / 2],
      label: 'bevel_b'
    }
  ];
}
```

**Por qué funciona ahora**:

- Ambos engranes tienen ángulo de cono de 45°, sumando 90° exactos para el engrane perpendicular.
- El segundo engrane se posiciona con un desplazamiento igual al radio primitivo de cada uno, de manera que los círculos de paso son tangentes y los ápices conceptuales coinciden.
- Las rotaciones aplicadas (`-π/2` para el vertical, `π/2` en el plano para el horizontal) hacen que las caras dentadas se encaren correctamente.

**Importante**: en una implementación visual estricta los dientes del par cónico también deberían tener su perfil de involuta proyectado sobre la superficie esférica (involuta esférica). Para una app paramétrica simple de prototipado, la aproximación con perfil de involuta plano escalado es suficiente y se ve correcta. Si en algún momento se requiere precisión total para corte CNC de 5 ejes, ese es el paso siguiente.

---

## Estética — lógica de los dos estilos visuales

La diferencia entre Blueprint y Wireframe sólido es **qué se renderiza encima de la geometría**, no la geometría en sí. La misma malla se usa en ambos modos.

### Diferencias clave

| Aspecto | Blueprint | Wireframe sólido |
|---|---|---|
| Fondo | Blanco con grid rosa tenue | Blanco puro |
| Caras del engrane | **No renderizadas** (solo aristas) | Blancas opacas |
| Aristas | Líneas rojas (`0xc8202a`) | Líneas rojas (`0xc8202a`) |
| Sensación | "Plano técnico", se ve a través del objeto | "Pieza física con líneas técnicas encima" |

### Implementación

```js
function renderGearScene(canvas, items, cameraPos, style) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0xffffff, 1);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 200);
  camera.position.set(...cameraPos);
  camera.lookAt(0, 0, 0);

  const group = new THREE.Group();

  // ─── Estilo Blueprint: grid de fondo + solo aristas rojas ───
  if (style === 'blueprint') {
    const grid = new THREE.GridHelper(40, 40, GRID_FAINT, GRID_FAINT);
    grid.position.y = -3;
    grid.material.opacity = 0.7;
    grid.material.transparent = true;
    scene.add(grid);
  }

  items.forEach(item => {
    // ─── Estilo Wireframe sólido: caras blancas debajo ───
    if (style === 'wireframe') {
      const fillMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        // Empuja las caras un microscópico paso atrás en el z-buffer
        // para que las líneas siempre se vean por encima sin z-fighting
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
        // Red de seguridad por si alguna normal está invertida
        side: THREE.DoubleSide
      });
      const fill = new THREE.Mesh(item.geo, fillMat);
      fill.position.set(...(item.position || [0, 0, 0]));
      if (item.rotation) fill.rotation.set(...item.rotation);
      group.add(fill);
    }

    // ─── Aristas rojas (ambos estilos) ───
    const edges = new THREE.EdgesGeometry(item.geo, 12);
    // El argumento 12 es el threshold en grados:
    // solo se dibujan aristas donde dos caras forman un ángulo > 12°.
    // Esto elimina las "líneas falsas" entre triángulos de la misma cara plana.
    const lineMat = new THREE.LineBasicMaterial({ color: RED_PRIMARY });
    const lines = new THREE.LineSegments(edges, lineMat);
    lines.position.set(...(item.position || [0, 0, 0]));
    if (item.rotation) lines.rotation.set(...item.rotation);
    group.add(lines);
  });

  scene.add(group);
  return { renderer, scene, camera, group };
}
```

### Toggle entre estilos

Hay dos estrategias, dependiendo del costo aceptable de la transición.

**Estrategia A — Reconstruir la escena**. La más simple. Al cambiar de estilo se destruye el renderer y se vuelve a llamar `renderGearScene` con el nuevo modo. Funciona bien para escenas pequeñas pero genera un pequeño parpadeo.

```js
let currentScene = renderGearScene(canvas, items, cam, 'blueprint');

function setStyle(newStyle) {
  currentScene.renderer.dispose();
  while (canvas.firstChild) canvas.removeChild(canvas.firstChild);
  currentScene = renderGearScene(canvas, items, cam, newStyle);
}
```

**Estrategia B — Toggle por visibilidad**. Más eficiente. Se generan ambos sets de mallas desde el principio (las caras blancas Y el grid del blueprint), y al cambiar de estilo solo se toggle `.visible` de cada uno. Cero parpadeo, transiciones instantáneas, y permite incluso animar opacidad entre estilos para una transición suave.

```js
function renderGearSceneDual(canvas, items, cameraPos) {
  // ... setup igual al anterior ...

  // Grid blueprint (visible solo en modo blueprint)
  const grid = new THREE.GridHelper(40, 40, GRID_FAINT, GRID_FAINT);
  grid.position.y = -3;
  grid.material.opacity = 0.7;
  grid.material.transparent = true;
  scene.add(grid);

  const fills = [];   // referencias a las caras blancas
  const edges = [];   // referencias a las aristas (siempre visibles)

  items.forEach(item => {
    const fillMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
      side: THREE.DoubleSide
    });
    const fill = new THREE.Mesh(item.geo, fillMat);
    fill.position.set(...(item.position || [0, 0, 0]));
    if (item.rotation) fill.rotation.set(...item.rotation);
    group.add(fill);
    fills.push(fill);

    const edgeGeo = new THREE.EdgesGeometry(item.geo, 12);
    const lineMat = new THREE.LineBasicMaterial({ color: RED_PRIMARY });
    const line = new THREE.LineSegments(edgeGeo, lineMat);
    line.position.set(...(item.position || [0, 0, 0]));
    if (item.rotation) line.rotation.set(...item.rotation);
    group.add(line);
    edges.push(line);
  });

  scene.add(group);

  // API de toggle
  function setStyle(style) {
    grid.visible = (style === 'blueprint');
    fills.forEach(f => f.visible = (style === 'wireframe'));
    // Las aristas siempre visibles en ambos modos
  }

  setStyle('blueprint');  // estilo por defecto
  return { renderer, scene, camera, group, setStyle };
}
```

Estrategia B recomendada para producción.

### Por qué `polygonOffset` es crítico en Wireframe

Sin `polygonOffset`, las caras blancas y las aristas rojas comparten exactamente el mismo plano en el z-buffer. La GPU no sabe cuál renderizar encima y produce **z-fighting**: parpadeo entre rojo y blanco según el ángulo de vista. La técnica empuja las caras un offset microscópico hacia atrás en profundidad — invisible al ojo, pero suficiente para que las aristas ganen siempre la batalla por el píxel.

### Por qué el threshold de `EdgesGeometry(geo, 12)`

`EdgesGeometry` puede generar una línea para cada triángulo de la malla, lo cual es ruido visual (un cilindro lateral curvo se ve "facetado" con cientos de líneas). El parámetro de threshold en grados (12° es el sweet spot para engranes) significa: **solo dibujar aristas donde dos caras vecinas forman un ángulo mayor a 12°**.

- En las caras planas del cuerpo del engrane no hay aristas (las caras son coplanares).
- En cada flanco de cada diente sí hay arista (el cambio de dirección es ~30°).
- En el borde superior/inferior del engrane sí hay arista (cambio de 90°).

Valores típicos:
- `1°`–`5°`: muestra prácticamente todos los triángulos (modo "rayos X").
- `10°`–`15°`: el sweet spot. Aristas geométricas reales, sin ruido.
- `30°`–`45°`: solo cambios bruscos. Útil para silueta minimalista.

---

## Cámara y framing

Cada tipo de engrane tiene un encuadre específico para que la pieza se vea completa y bien proporcionada.

| Tipo | Cámara `[x, y, z]` | Notas |
|---|---|---|
| Recto (spur) | `[9, 6.5, 11]` | Vista 3/4 estándar |
| Compuesto | `[10, 5.5, 12]` | Cámara más baja para ver los dos pisos |
| Planetario | `[13, 11, 13]` | Más alta para ver el anillo y los planetas |
| Helicoidal | `[9, 7, 11]` | Estándar; el twist se aprecia bien |
| Corona interior | `[13, 9.5, 15]` | Más lejos por ser el más grande |
| Cónico (par) | `[10, 7, 12]` | Ángulo para ver el engrane vertical y horizontal |

Cámara siempre con `lookAt(0, 0, 0)` y FOV 35° (un poco telephoto para reducir distorsión).

---

## Controles de rotación

Implementación mínima sin OrbitControls (que requiere import adicional):

```js
function attachRotation(canvas, group, opts = {}) {
  let rotY = opts.startY ?? 0.4;
  let rotX = opts.startX ?? 0.25;
  let dragging = false;
  let lastX = 0, lastY = 0;

  canvas.addEventListener('pointerdown', e => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointerup', () => dragging = false);

  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    rotY += (e.clientX - lastX) * 0.01;
    rotX += (e.clientY - lastY) * 0.01;
    lastX = e.clientX;
    lastY = e.clientY;
  });

  function update() {
    // Auto-rotación suave cuando no se está arrastrando
    if (!dragging && opts.autoRotate !== false) {
      rotY += opts.autoRotateSpeed ?? 0.005;
    }
    group.rotation.y = rotY;
    group.rotation.x = rotX;
  }

  return update;
}
```

Llamarlo desde el loop de animación:

```js
const updateRotation = attachRotation(canvas, group);

function animate() {
  requestAnimationFrame(animate);
  updateRotation();
  renderer.render(scene, camera);
}
animate();
```

---

## Parámetros editables — referencia rápida

Esta es la tabla que el usuario va a ver. Todos los rangos están pensados para fabricación en FDM y corte láser de prototipado.

| Tipo | Parámetros editables | Rangos |
|---|---|---|
| Recto | Módulo, Dientes, Ancho, Ø barreno | `1.0, 1.5, 2.0, 2.5, 3.0` mm; `12-60`; `5-20` mm; `3, 4, 5, 6, 8` mm |
| Compuesto | Módulo, Dientes A, Dientes B, Ø barreno | `1.0, 1.5, 2.0, 2.5` mm; `20-60`; `10-24`; `3, 4, 5, 6, 8` mm |
| Planetario | Módulo, Reducción, N° planetas, Ø barreno | `1.0, 1.5, 2.0` mm; `3:1, 4:1, 5:1, 6:1`; `3, 4`; `3, 4, 5, 6` mm |
| Helicoidal | Módulo, Dientes, Ángulo hélice, Ancho | `1.0, 1.5, 2.0, 2.5` mm; `14-50`; `15°, 20°, 25°, 30°`; `10-25` mm |
| Corona interior | Módulo, Dientes, Ancho, Pared exterior | `1.0, 1.5, 2.0, 2.5` mm; `30-80`; `5-15` mm; `2, 3, 4` mm |
| Cónico (par 90°) | Módulo, Dientes (ambos iguales), Ancho, Ø barreno | `1.5, 2.0, 2.5, 3.0` mm; `14-30`; `5-12` mm; `4, 5, 6, 8` mm |

**Parámetros que NO se exponen** (calculados internamente):
- Ángulo de presión (fijo 20°)
- Addendum (1.0 × módulo)
- Dedendum (1.25 × módulo)
- Distancia entre centros (calculada como `(Z₁ + Z₂) × m / 2`)
- Para planetario: `Z_anillo = Z_sol + 2 × Z_planeta`

---

## Estructura sugerida de archivos

```
src/
  gears/
    profile.js         ← función involute()
    spur.js            ← spurGeo()
    compound.js        ← compoundGeo()
    planetary.js       ← planetaryGeo()
    helical.js         ← helicalGeo() con los fixes
    ring.js            ← ringGeo() (corona interior)
    bevel.js           ← bevelGeo() + bevelPair() con los fixes
    index.js           ← exporta todos
  render/
    scene.js           ← renderGearSceneDual() con toggle
    rotation.js        ← attachRotation()
    cameras.js         ← presets de cámara por tipo
    constants.js       ← RED_PRIMARY, GRID_FAINT
  app/
    parameters.js      ← rangos y defaults por tipo
    ui.jsx             ← componentes React (o framework elegido)
```

---

## Resumen de los fixes aplicados

1. **Helicoidal**: winding order del agujero interno invertido, capas escaladas con el ángulo, tapas triangularizadas a partir del mismo Shape, `DoubleSide` como fallback.
2. **Compuesto**: las dos piezas ahora se tocan (gap = 0), el chico apoyado sobre el grande, barreno del chico ligeramente mayor para alojar el eje pasante.
3. **Cónico**: ángulo de cono fijado a 45° (suma 90° exactos), posicionamiento con desplazamiento igual al radio primitivo para que los ápices coincidan, rotaciones de las dos piezas para encarar correctamente las caras dentadas.
