// Deliberately minimal — this exists only so the browser considers
// the app "installable" (Add to Home Screen / desktop install icon).
// It does NOT cache anything and does NOT enable offline use. Every
// request still goes straight to the network, exactly as if this
// file didn't exist. That's intentional: caching the app shell or
// API responses risks showing stale fuel prices, stock levels, or an
// outdated app version after a deploy — not worth the tradeoff for
// what this is meant to do (just the installable icon).
//
// If real offline support is built later, this file is where that
// logic would go — for now it's a placeholder that changes nothing.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // No-op: falls through to the browser's default network handling.
});
