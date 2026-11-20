// Configuração do CRM FEMIK.
// Enquanto SUPABASE_URL e SUPABASE_ANON_KEY estiverem vazios, o CRM roda em
// MODO DEMONSTRAÇÃO: os dados ficam guardados só neste aparelho (localStorage).
// Depois de criar o projeto no Supabase (ver README.md), cole aqui a URL e a
// chave "anon public" do projeto. A chave anon é pública por desenho: a
// segurança vem das políticas RLS do arquivo supabase/schema.sql.

export const CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  STORAGE_BUCKET: 'documentos',
  APP_NAME: 'CRM Femik',
  VERSION: '0.1.6',
};

export const DEMO_MODE = !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY;
