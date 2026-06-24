# Informe técnico — Mejoras OtoReport v2

**Estado:** 10 de 11 mejoras implementadas (la #11 es documentación de repo, fuera de la app).
**Verificación:** `npx tsc --noEmit` ✅ · `cargo check` ✅ en cada cambio.
**Compatibilidad:** los reportes antiguos siguen abriendo (campos nuevos opcionales en TS / `#[serde(default)]` en Rust).

---

## 1. Traducción al inglés

**Qué cambia:** se corrigieron errores de terminología y se localizaron textos que estaban fijos en español (no cambiaban al inglés).

- Abreviaturas de oído corregidas: `Left Ear (OS)` → `(L)` y `Right Ear (OD)` → `(R)` (OS/OD son abreviaturas oculares, no auriculares). También en el PDF.
- Orden de identificación alineado: `patients.rut` → `RUT / ID / DNI`.
- Textos hardcoded pasados a i18n: tooltips de la galería de fotos, **todo el diálogo de exportar PDF**, y el texto "Sin fecha".

**Archivos:** `src/i18n/locales/en.json`, `es.json`; `src/components/capture/PhotoGallery.tsx`; `src/components/otoscopy/ReportPreview.tsx`, `ReportForm.tsx`; `src/pages/PatientDetail.tsx`.

**Dónde verlo:** botón de idioma en la barra superior (Header). Revisar especialmente el diálogo de PDF y la galería de imágenes en inglés.

---

## 2. Color oído derecho (rojo) / izquierdo (azul)

**Qué cambia:** el encabezado de cada oído ahora se muestra en rojo (OD) o azul (OI), con una franja superior del mismo color. Mismos tonos que ya usaba el PDF.

**Archivos:** `src/components/otoscopy/EarPanel.tsx`.

**Dónde verlo:** pantalla de informe (Nuevo Informe) → paneles "Oído Derecho" y "Oído Izquierdo".

---

## 3. Otoscopía neumática

**Qué cambia:** nuevo apartado por oído para registrar la movilidad timpánica: **No evaluada / Normal / Disminuida / Ausente**, con campo de notas opcional.

**Archivos:** `src/types/findings.ts` (tipo `PneumaticOtoscopy`), `src/types/report.ts` (`EarData.pneumatic`), `src/hooks/useReports.ts`, `src-tauri/src/commands/reports.rs`, `src/components/otoscopy/EarPanel.tsx`, `src/components/export/PdfReport.tsx`, i18n `ear.pneumatic.*`.

**Dónde verlo:** panel de cada oído, entre los hallazgos y las observaciones. En el PDF aparece como línea bajo los hallazgos del oído.

---

## 4–6, 8–10. Anamnesis y antecedentes (bloque unificado)

**Qué cambia:** nueva sección clínica con 6 grupos de casillas + campo "otros" cada uno:

| Mejora | Grupo |
|--------|-------|
| 4 | Síntomas asociados (prurito, otalgia, tinnitus, plenitud, hipoacusia, otorrea, vértigo) |
| 5 | Antecedentes respiratorios (rinitis, sinusitis, asma, hipertrofia adenoidea…) |
| 6 | Factores de riesgo OME (sala cuna, humo de tabaco, biberón, alergias…) |
| 8 | Factores predisponentes otitis externa (natación, humedad, trauma, dermatitis…) |
| 10 | Comorbilidades e inmunocompromiso (diabetes, inmunosupresión, VIH, quimio…) |
| 9 | Opciones terapéuticas (observación, ATB tópico/oral, corticoide, derivación ORL…) |

**Archivos:** `src/types/anamnesis.ts` (nuevo), `src/types/index.ts`, `src/types/report.ts`, `src/hooks/useReports.ts`, `src-tauri/src/commands/reports.rs`, `src/components/otoscopy/AnamnesisSection.tsx` (nuevo), `ReportForm.tsx`, `PdfReport.tsx`, i18n `report.anamnesis.*`.

**Dónde verlo:** pantalla de informe → sección colapsable **"Anamnesis y antecedentes"**, justo debajo de los datos del paciente. Se incluye en el PDF como sección propia (solo los ítems marcados).

**Decisión:** se guarda dentro del informe (snapshot de la sesión), no en el paciente.

---

## 7. Variantes clínicas de otitis externa

**Qué cambia:** nueva categoría **"Otitis Externa"** en el checklist de hallazgos, con las variantes pedidas: difusa, localizada (forúnculo), eccematosa, micótica (otomicosis), maligna (necrotizante) y celulitis. Las traducciones ya existían en la biblioteca; faltaba exponerlas en el checklist.

**Archivos:** `src/types/report.ts` (`getDefaultFindingsCategories` + `translateFindingsCategories`), `src/i18n/findings/es.json`, `en.json`.

**Dónde verlo:** panel de cada oído → checklist de hallazgos → categoría "Otitis Externa". En informes nuevos aparece automáticamente; en informes/perfiles previos se incorpora con el botón **"Actualizar hallazgos"**.

---

## 13. Cancelar / atrás / deshacer en el registro de otoscopía

**Qué cambia:** bajo el diagrama timpánico hay 3 botones nuevos:
- **Cancelar** — quita la selección de hallazgo activa.
- **Atrás** — deshace la última marca (historial real por acción).
- **Deshacer todo** — borra todas las marcas del diagrama.

**Archivos:** `src/components/otoscopy/EarPanel.tsx`, i18n `ear.diagram.*`.

**Dónde verlo:** panel de cada oído, fila de botones debajo del diagrama timpánico.

**Nota:** el editor de imágenes **ya tenía** deshacer/limpiar; este cambio cubre el diagrama, que era lo que faltaba.

---

## 14. Ayuda, manual e información de contacto

**Qué cambia:** nueva pestaña **"Ayuda"** en Ajustes con: manual paso a paso (7 pasos), atajos del editor de imágenes, FAQ, y contacto/soporte.

**Archivos:** `src/pages/Settings.tsx` (nueva pestaña), i18n `settings.help.*` y `settings.tabs.help`.

**Dónde verlo:** Ajustes → pestaña **Ayuda** (icono de libro). Enlace directo: `/settings?tab=ayuda`.

---

## 12. Consultas, errores y sugerencias

**Qué cambia:** formulario en la pestaña Ayuda. Selecciona tipo (Consulta/Error/Sugerencia), escribe el mensaje y se abre un **issue de GitHub prellenado** (título, cuerpo, etiqueta) con la versión de la app y la plataforma adjuntas. Botón alterno de Instagram.

**Archivos:** `src/components/settings/FeedbackForm.tsx` (nuevo), `src/pages/Settings.tsx`, i18n `settings.feedback.*`.

**Dónde verlo:** Ajustes → pestaña Ayuda → sección "Consultas, errores y sugerencias".

---

## 15. Mensajes de confirmación

**Qué cambia:** componente reutilizable `ConfirmDialog` y dos confirmaciones nuevas:
- Al **cerrar la app** (botón X) → "¿Cerrar OtoReport? Cambios sin guardar podrían perderse".
- Al **eliminar una imagen** → confirmación de borrado permanente.

(Eliminar paciente e informe ya confirmaban de antes.)

**Archivos:** `src/components/ui/ConfirmDialog.tsx` (nuevo), `src/components/layout/Header.tsx`, `src/components/capture/PhotoGallery.tsx`, i18n `common.confirm`, `header.confirmClose.*`, `ear.confirmDeleteImage.*`.

**Dónde verlo:** botón X de la ventana; ícono de papelera en la galería de fotos.

---

## Resumen de archivos

**Nuevos (4 componentes/tipos):**
- `src/types/anamnesis.ts`
- `src/components/otoscopy/AnamnesisSection.tsx`
- `src/components/ui/ConfirmDialog.tsx`
- `src/components/settings/FeedbackForm.tsx`

**Modificados (frontend):** `types/findings.ts`, `types/report.ts`, `types/index.ts`, `hooks/useReports.ts`, `components/otoscopy/EarPanel.tsx`, `ReportForm.tsx`, `ReportPreview.tsx`, `components/export/PdfReport.tsx`, `components/capture/PhotoGallery.tsx`, `components/layout/Header.tsx`, `pages/Settings.tsx`, `pages/PatientDetail.tsx`, los 4 archivos i18n (`locales/es.json`, `locales/en.json`, `findings/es.json`, `findings/en.json`).

**Modificados (backend):** `src-tauri/src/commands/reports.rs` (`EarData.pneumatic`, `Report.anamnesis` como `serde_json::Value` con default).

**Pendiente:** #11 documentación técnica / guía de instalación → tarea de repositorio (README/docs), no de la app.

---

## Notas técnicas

- **Persistencia:** anamnesis y otoscopía neumática se guardan en `report.json` (workspace). En Rust se modelan como `serde_json::Value` opaco con `#[serde(default)]` → cero acoplamiento de esquema y compatibilidad con reportes antiguos.
- **Auto-guardado:** se respeta el debounce existente de 2s; los campos nuevos se persisten igual que el resto del informe.
- **i18n:** ES y EN quedan en paridad de claves (632 cada uno en `locales`). Las listas de la pestaña Ayuda usan `t(..., { returnObjects: true })`, editables solo desde JSON.
- **Variantes de otitis externa:** solo afectan informes nuevos por defecto; los existentes las incorporan con "Actualizar hallazgos".
