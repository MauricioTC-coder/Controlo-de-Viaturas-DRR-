const CACHE_NAME = 'controlo-viaturas-cache-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/icon.png'
];

// Instalação do Service Worker - Pré-caching dos recursos bases estáveis
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// Ativação - Limpeza de caches antigas e ganho do controle dos clientes imediatamente
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceção de pedidos (Fetch) - Estratégia Network-First com Fallback Offline Cache
self.addEventListener('fetch', event => {
  // Apenas responder a pedidos GET locais
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Se a resposta for válida, atualizar o cache dinamicamente
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Em caso de falha de ligação (offline), carregar do cache
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Se for uma navegação e falhar, dar fallback para a raiz
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});
