export async function requestPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function sendNotification(title, body, score) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const n = new Notification(`🚨 ${title}`, {
    body: `Confidence: ${score}/100 — ${body}`,
    icon: '/vite.svg',
    tag: title,
    requireInteraction: false,
  });
  setTimeout(() => n.close(), 8000);
}
