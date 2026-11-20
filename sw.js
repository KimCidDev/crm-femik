// Service worker do CRM Femik: guarda a "casca" da aplicação para abrir rápido
// e funcionar como app instalada. Os dados (Supabase) passam sempre pela rede.
const CACHE = 'crm-femik-v0.1.2';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/config.js', 'js/data.js', 'js/store.js', 'js/ui.js', 'js/forms.js',
  'js/views/dashboard.js', 'js/views/pipeline.js', 'js/views/leads.js', 'js/views/tasks.js',
  'js/views/proposals.js', 'js/views/clients.js', 'js/views/reports.js', 'js/views/team.js', 'js/views/settings.js',
  'icons/logo.svg', 'icons/logo-escuro.svg', 'icons/simbolo.svg', 'icons/icon-192.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Mesmo domínio: responde do cache e atualiza em segundo plano.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then((res) => { if (res.ok) cache.put(e.request, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
