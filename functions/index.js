const { initializeApp } = require("firebase-admin/app");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");

initializeApp();

const db = getFirestore();
const messaging = getMessaging();

function notificationCategory(eventType = "") {
  const value = String(eventType).toLowerCase();
  if (value.includes("report")) return "reports";
  if (value.includes("meeting") || value.includes("mom") || value.includes("action")) return "meetings";
  if (value.includes("document")) return "documents";
  return "general";
}

function safeText(value, fallback, maxLength) {
  const text = String(value || fallback || "").trim();
  return text.slice(0, maxLength);
}

function pushCopy(category, notification) {
  if (category === "reports") {
    return {
      title: "Monthly report update",
      body: "A secure GrowVest report update is ready. Open the Investor App to view it."
    };
  }
  if (category === "documents") {
    return {
      title: "Document update",
      body: "A secure document update is available in your GrowVest Investor App."
    };
  }
  if (category === "meetings") {
    return {
      title: safeText(notification.title, "Review update", 90),
      body: "A meeting, review or MOM update is available in your GrowVest Investor App."
    };
  }
  return {
    title: safeText(notification.title, "GrowVest update", 90),
    body: safeText(notification.message, "You have a new secure investor update.", 220)
  };
}

function secureLink(value = "") {
  const link = String(value || "").trim();
  return link.startsWith("/investor/") ? link : "/investor/notifications";
}

async function removeInvalidSubscriptions(subscriptions, response) {
  const invalidCodes = new Set([
    "messaging/registration-token-not-registered",
    "messaging/invalid-registration-token"
  ]);
  const batch = db.batch();
  let removals = 0;

  response.responses.forEach((item, index) => {
    if (!item.success && invalidCodes.has(item.error?.code)) {
      batch.delete(subscriptions[index].ref);
      removals += 1;
    }
  });

  if (removals) await batch.commit();
  return removals;
}

exports.sendInvestorPushNotification = onDocumentCreated({
  document: "notifications/{notificationId}",
  region: "asia-south1",
  retry: false,
  memory: "256MiB",
  timeoutSeconds: 60
}, async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;

  const notification = snapshot.data();
  const recipientUid = notification.recipientUid;
  if (!recipientUid) {
    logger.info("Notification has no recipientUid; push skipped", { notificationId: snapshot.id });
    return;
  }

  const [userSnapshot, preferenceSnapshot, subscriptionSnapshot] = await Promise.all([
    db.collection("users").doc(recipientUid).get(),
    db.collection("notificationPreferences").doc(recipientUid).get(),
    db.collection("pushSubscriptions").where("recipientUid", "==", recipientUid).get()
  ]);

  const user = userSnapshot.exists ? userSnapshot.data() : null;
  if (!user || user.status !== "active" || user.role !== "investor" || user.portalEnabled === false) {
    if (!subscriptionSnapshot.empty) {
      const cleanup = db.batch();
      subscriptionSnapshot.docs.forEach((item) => cleanup.delete(item.ref));
      await cleanup.commit();
    }
    logger.info("Recipient is not an active Investor Portal user; push skipped", { recipientUid, notificationId: snapshot.id });
    return;
  }

  const preferences = preferenceSnapshot.exists ? preferenceSnapshot.data() : {};
  if (preferences.pushEnabled === false) {
    logger.info("Push disabled by recipient preference", { recipientUid, notificationId: snapshot.id });
    return;
  }

  const category = notificationCategory(notification.eventType);
  if (preferences.pushCategories?.[category] === false) {
    logger.info("Push category disabled", { recipientUid, category, notificationId: snapshot.id });
    return;
  }

  const subscriptions = subscriptionSnapshot.docs.filter((item) => {
    const data = item.data();
    return data.active !== false && Boolean(data.token);
  });
  const unique = [];
  const seen = new Set();
  subscriptions.forEach((item) => {
    const token = item.data().token;
    if (!seen.has(token)) {
      seen.add(token);
      unique.push(item);
    }
  });

  if (!unique.length) {
    logger.info("No active push subscriptions", { recipientUid, notificationId: snapshot.id });
    return;
  }

  const copy = pushCopy(category, notification);
  const title = copy.title;
  const body = copy.body;
  const link = secureLink(notification.link);
  const tokens = unique.slice(0, 500).map((item) => item.data().token);

  const response = await messaging.sendEachForMulticast({
    tokens,
    data: {
      notificationId: snapshot.id,
      eventType: safeText(notification.eventType, "general_update", 80),
      category,
      title,
      body,
      link,
      icon: "/icons/growvest-pwa-192.png",
      badge: "/icons/growvest-pwa-192.png",
      tag: `growvest-${snapshot.id}`,
      requireInteraction: category === "meetings" ? "true" : "false"
    },
    webpush: {
      headers: {
        Urgency: category === "meetings" ? "high" : "normal",
        TTL: category === "meetings" ? "86400" : "259200"
      }
    }
  });

  const removedInvalidTokens = await removeInvalidSubscriptions(unique.slice(0, 500), response);
  await snapshot.ref.set({
    pushDelivery: {
      attemptedAt: FieldValue.serverTimestamp(),
      successCount: response.successCount,
      failureCount: response.failureCount,
      removedInvalidTokens
    }
  }, { merge: true });

  logger.info("GrowVest push delivery completed", {
    notificationId: snapshot.id,
    recipientUid,
    category,
    successCount: response.successCount,
    failureCount: response.failureCount,
    removedInvalidTokens
  });
});
