# Plan: Material Educativo con Imágenes Reales

## Contexto
Los SVGs generados por código para el módulo educativo se ven mal. Se reemplazarán por ilustraciones anatómicas reales (imágenes PNG) manteniendo la interactividad.

---

## Imágenes que necesito del usuario

### Módulo 1 — Anatomía del Oído (1 imagen)

| Archivo | Qué debe mostrar |
|---------|-----------------|
| `ear_anatomy_cross_section.png` | Corte transversal completo del oído. Oído externo a la izquierda, interno a la derecha. Estilo libro de texto médico. Las 9 estructuras deben estar claramente diferenciadas visualmente. |

**Estructuras que deben verse:**
1. Pabellón auricular (hélix, antihélix, concha, trago, lóbulo)
2. Conducto auditivo externo (CAE)
3. Membrana timpánica
4. Oído medio (caja timpánica)
5. Cadena de huesecillos (martillo, yunque, estribo)
6. Tuba de Eustaquio
7. Cóclea
8. Canales semicirculares
9. Nervio auditivo (VIII par)

**Specs:** 1200×800px, PNG, fondo transparente o oscuro neutro (~#1a1a2e), sin etiquetas de texto.

**Interacción:** Una sola imagen base con polígonos SVG transparentes superpuestos como hitboxes. Al hover/click, el polígono se colorea semi-transparente sobre la zona y se muestra la descripción en el panel lateral. Las coordenadas de los polígonos se trazan una vez sobre la imagen.

---

### Módulo 2 — Membrana Timpánica (6 imágenes)

| Archivo | Qué debe mostrar |
|---------|-----------------|
| `tympanum_normal.png` | MT normal: translúcida, gris perla, cono luminoso visible, mango del martillo, umbo |
| `tympanum_retraction.png` | MT retraída: membrana hundida, mango prominente y horizontalizado |
| `tympanum_perforation.png` | MT perforada: agujero visible en la membrana |
| `tympanum_effusion.png` | MT con efusión: nivel de líquido, burbujas de aire, color ambarino |
| `tympanum_tympanosclerosis.png` | MT con timpanoesclerosis: parches blancos calcificados |
| `tympanum_otitis_media.png` | MT con otitis media aguda: roja, abombada, vasos dilatados |

**Specs:** 800×800px, PNG, fondo transparente. **Crítico:** mismo encuadre y posición del tímpano en las 6 imágenes (para transición fade suave). Vista otoscópica estándar.

**Interacción:** Se selecciona una patología → fade transition entre imágenes apiladas (CSS opacity). Labels opcionales de cuadrantes como SVG superpuesto.

---

### Módulo 3 — Tuba de Eustaquio (4 imágenes)

| Archivo | Qué debe mostrar |
|---------|-----------------|
| `eustachian_idle.png` | Oído medio con tuba cerrada en reposo. Tímpano a la izquierda, nasofaringe a la derecha. |
| `eustachian_swallowing.png` | Tuba abierta, flechas de flujo de aire entrando al oído medio |
| `eustachian_blocked.png` | Tuba obstruida/inflamada, indicador de presión negativa |
| `eustachian_effusion.png` | Tuba bloqueada + líquido acumulado en la cavidad del oído medio |

**Specs:** 1000×700px, PNG, fondo transparente. Mismo encuadre en las 4 imágenes, solo cambia el estado de la tuba y sus consecuencias.

**Interacción:** Botones de demo → fade entre imágenes.

---

## Almacenamiento

```
public/education/
  ear_anatomy_cross_section.png     (1 imagen)
  tympanum_normal.png               (6 imágenes)
  tympanum_retraction.png
  tympanum_perforation.png
  tympanum_effusion.png
  tympanum_tympanosclerosis.png
  tympanum_otitis_media.png
  eustachian_idle.png               (4 imágenes)
  eustachian_swallowing.png
  eustachian_blocked.png
  eustachian_effusion.png
```

Total: **11 imágenes**

---

## Implementación por componente

### Anatomía (`EarAnatomySvg.tsx`)
- `<img>` base con la ilustración
- `<svg>` superpuesto (`absolute inset-0`) con `viewBox="0 0 1200 800"` (mismas dims que la imagen)
- Cada estructura es un `<polygon>` con coordenadas trazadas sobre la imagen
- Hover: `fill` con color semi-transparente (`opacity 0.35`) + borde blanco
- Panel lateral con lista de estructuras y descripción (se mantiene igual)
- Los polígonos se trazan una vez con herramienta tipo image-map.net

### Tímpano (`TympanumInteractive.tsx`)
- Stack de 6 `<img>` apiladas con `absolute inset-0`
- La activa tiene `opacity-100`, las demás `opacity-0`
- `transition-opacity duration-500` para fade suave
- Precargar las 6 imágenes en `useEffect` para evitar flash
- SVG overlay opcional para labels de cuadrantes/landmarks
- Eliminar toda la lógica SVG de patologías animadas

### Tuba (`EustachianTubeDemo.tsx`)
- Mismo patrón que tímpano: stack de 4 imágenes con fade
- `transition-opacity duration-700` (más lenta)
- Simplificar: eliminar `animating`/timeouts, `runDemo` pasa a ser solo `setState`
- Eliminar toda la lógica SVG de animaciones

---

## Archivos a modificar
- `src/components/education/EarAnatomySvg.tsx` — Reescritura completa
- `src/components/education/TympanumInteractive.tsx` — Reescritura completa
- `src/components/education/EustachianTubeDemo.tsx` — Reescritura completa

## Verificación
1. `npx tsc --noEmit` — Sin errores
2. Activar beta en Settings → General → Funciones experimentales
3. Ir a Material Educativo, probar los 3 módulos
4. Verificar que las transiciones fade sean suaves
5. Verificar que los hitboxes del módulo anatomía se alineen con las estructuras de la imagen
