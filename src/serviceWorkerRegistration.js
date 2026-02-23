// 이 파일은 service worker를 등록하는 역할만 합니다 
export function register(config) {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;
      
      navigator.serviceWorker.register(swUrl).then((registration) => {
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // 사용자가 이전에 업데이트를 거부했는지 확인
                const updateDeclined = localStorage.getItem('updateDeclined');
                
                if (!updateDeclined) {
                  if (config && config.onUpdate) {
                    config.onUpdate(registration);
                  }
                } else {
                  console.log('📌 사용자가 업데이트를 거부했습니다');
                }
              }
            }
          };
        };
      });
    });
  }
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      });
  }
}