self.addEventListener('install', (event) => {
    console.log('Service Worker installed');
});

self.addEventListener('fetch', (event) => {
    // iOS에서 PWA 모드를 안정적으로 인식하게 해주는 빈 핸들러
});
