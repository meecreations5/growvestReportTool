self.addEventListener("notificationclick", (event) => {
  event.stopImmediatePropagation();
  const link = event.notification?.data?.link || "/investor/notifications";
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      const sameOrigin = windowClients.find((client) => client.url.startsWith(self.location.origin));
      if (sameOrigin) {
        sameOrigin.navigate(link);
        return sameOrigin.focus();
      }
      return self.clients.openWindow(link);
    })
  );
});

importScripts("https://www.gstatic.com/firebasejs/12.2.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.2.1/firebase-messaging-compat.js");

const params = new URL(self.location.href).searchParams;
const firebaseConfig = {
  apiKey: params.get("apiKey") || "",
  authDomain: params.get("authDomain") || "",
  projectId: params.get("projectId") || "",
  storageBucket: params.get("storageBucket") || "",
  messagingSenderId: params.get("messagingSenderId") || "",
  appId: params.get("appId") || ""
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload?.data || {};
  return self.registration.showNotification(data.title || "GrowVest update", {
    body: data.body || "You have a new secure investor update.",
    icon: data.icon || "/icons/growvest-pwa-192.png",
    badge: data.badge || "/icons/growvest-pwa-192.png",
    tag: data.tag || "growvest-investor-update",
    renotify: true,
    requireInteraction: data.requireInteraction === "true",
    data: {
      link: data.link || "/investor/notifications",
      notificationId: data.notificationId || ""
    }
  });
});
