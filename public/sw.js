self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    // Langsung aktif
});

// Wajib ada event fetch agar Chrome mengenali ini sebagai PWA
self.addEventListener('fetch', (e) => {
    // Saat ini pass-through saja agar tidak ganggu request NextJS
});
