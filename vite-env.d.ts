/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  // Nada de claves secretas aqui: todo VITE_* acaba en el bundle publico.
  // Gemini va por Edge Function con GEMINI_API_KEY (Supabase secrets).
  // add more env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
