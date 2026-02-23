// 매우 간단하고 안전한 버전
const CACHE_NAME = 'worlaland-wallet-v1-2025-11-19-2';

// 설치 단계 - 최소한만 캐시
self.addEventListener('install', (event) => {
  console.log('✅ Service Worker 설치됨');
  // 즉시 활성화
  self.skipWaiting();
});

// 활성화 단계
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker 활성화됨');
  
  event.waitUntil(
    // 오래된 캐시 삭제
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ 오래된 캐시 삭제:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // 즉시 모든 클라이언트 제어
      return self.clients.claim();
    })
  );
});

// fetch 이벤트 - Network First 전략 (더 안전함)
self.addEventListener('fetch', (event) => {
  // Service Worker 자신이나 chrome-extension은 캐시하지 않음
  if (event.request.url.includes('chrome-extension')) {
    return;
  }
  
  event.respondWith(
    // 먼저 네트워크에서 가져오기 시도
    fetch(event.request)
      .then((response) => {
        // 성공하면 캐시에 저장
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            // cache.put(event.request, responseToCache);
            if (event.request.method === 'GET') {
              cache.put(event.request, responseToCache);
            }
          });
        }
        return response;
      })
      .catch(() => {
        // 네트워크 실패 시 캐시에서 가져오기
        return caches.match(event.request);
      })
  );
});