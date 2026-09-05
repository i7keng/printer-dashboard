// Service worker สำหรับ "เปลือกแอป" (app shell) เท่านั้น
//
// ข้อจำกัดที่ตั้งใจ: หน้าแดชบอร์ดจริง (ข้อมูลหมึก/สาขา) โหลดผ่าน <iframe> ที่ชี้ไป
// Apps Script คนละ origin (script.google.com) — service worker นี้ "ไม่"
// แคชหรือควบคุมเนื้อหาข้างในนั้น เพราะ:
//   1) เป็นคนละ origin ตาม browser security model จึง intercept ไม่ได้อยู่แล้ว
//   2) ข้อมูลหมึกต้องเป็นข้อมูลสดเสมอ การแคชไว้จะทำให้เห็นข้อมูลเก่าที่อาจเข้าใจผิดได้
//
// สิ่งที่ทำ: แคชแค่ไฟล์เปลือกแอป (index.html, ไอคอน, manifest, benefit.html)
// เพื่อให้ "เปิดแอปได้ทันที" (ไม่ขึ้นจอขาว) แม้เน็ตหลุดชั่วคราว ส่วนข้อมูลข้างใน
// iframe ยังต้องมีเน็ตเพื่อโหลดเหมือนเดิม

const CACHE_VERSION = 'toner-dashboard-shell-v1';
const SHELL_ASSETS = [
  './index.html',
  './benefit.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // แคชเฉพาะ GET request ของไฟล์เปลือกแอปที่เป็น origin เดียวกับ service worker นี้เท่านั้น
  // (คำขอไป script.google.com ของ iframe จะไม่ผ่านมาที่นี่อยู่แล้วตาม browser security model
  // แต่กันไว้อีกชั้นด้วย same-origin check เพื่อความชัดเจน)
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          // อัปเดตแคชเงียบๆ ทุกครั้งที่โหลดสำเร็จ (stale-while-revalidate)
          const resClone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => cached); // ออฟไลน์ → ใช้ของที่แคชไว้

      return cached || network;
    })
  );
});
