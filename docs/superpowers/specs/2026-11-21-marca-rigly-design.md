# Marca Rigly — diseño

## Intención

La plataforma pasa a llamarse **Rigly** y usa las imágenes nuevas de
`frontend/public/` (logo horizontal, logo vertical, favicon y placeholder).

## Objetivos

- El nombre visible y el título de la pestaña son "Rigly" (ES y EN).
- La barra de navegación muestra el logo en lugar del cuadrado degradado y el texto.
- El h1 del catálogo deja de ser "Comparador de hardware" y pasa a ser un eslogan.
- El favicon nuevo funciona en todos los navegadores.
- El placeholder nuevo no penaliza la carga.

## No objetivos

- No se cambian colores, tipografía ni el resto del diseño (el naranja del logo ya
  encaja con `--accent`).
- No se renombra el paquete npm ni el repositorio.

## Enfoques

1. **`<img>` con los PNG en la barra (elegido).** Simple; el logo es naranja sobre
   transparente y se ve bien en claro y oscuro.
2. Redibujar el logo como SVG inline. Más nítido, pero hay que recrear el arte: fuera
   de alcance.
3. Logo como `background-image` en CSS. Pierde el `alt` y complica la accesibilidad.

## Diseño

- `i18n/es.ts` y `en.ts`: `common.appTitle` = "Rigly"; `catalog.title` =
  "Encuentra el mejor precio en hardware" / "Find the best price on hardware".
- `nav-bar.tsx`: el enlace de marca muestra `logohorizontal.png` en escritorio y
  `logovertical.png` en celular/tablet (`BELOW_DESKTOP`), con `alt` = `appTitle`.
  Se eliminan `.brand-mark` y `.brand-name`. Alto ~32px en escritorio, ~40px compacto,
  sin superar el alto de la barra.
- Favicon: el archivo es PNG con extensión `.svg`; se renombra a `favicon.png` y
  `index.html` usa `type="image/png"`.
- Placeholder: es un JPEG de 2,1 MB (2400×1792). Se reduce a 800px de ancho
  (<100 KB) conservando el nombre `placeholder.png`, para no tocar `product-image.tsx`.
- `README.md`: título "Rigly".

## Lo que queda al implementador

Tamaño exacto de los logos y la herramienta para comprimir el placeholder.
