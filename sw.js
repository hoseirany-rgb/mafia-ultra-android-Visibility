
self.addEventListener('install', e => {
e.waitUntil(
caches.open('mafiapedi2-hybrid').then(cache => {
return cache.addAll([
'/',
'/index.html',
'/styles.css',
'/app.js',
'/dialogues.json'
]);
})
);
});
