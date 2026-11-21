// Punto de entrada del frontend: carga fuentes e i18n y monta <App /> en #root.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/space-grotesk'
import '@fontsource-variable/jetbrains-mono'
// i18n se importa antes que App: se inicializa de forma síncrona al importarse,
// así el primer render ya tiene los textos en el idioma inicial.
import './i18n/index.ts'
import App from './app.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
