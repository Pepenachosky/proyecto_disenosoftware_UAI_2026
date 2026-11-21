// Configuración de Vite: solo el plugin de React (JSX y Fast Refresh).
// Las variables VITE_SUPABASE_* se leen de frontend/.env (ver src/supabase.ts).
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})
