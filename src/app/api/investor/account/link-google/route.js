import { NextResponse } from "next/server";
import { adminAuth, adminDb, verifyAppRequest } from "@/lib/server/firebaseAdmin";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const actor = await verifyAppRequest(request);
    if (actor.role !== "investor" || !actor.investorId) {
      return NextResponse.json({ error: "Only an active Investor account can link Google." }, { status: 403 });
    }

    const body = await request.json();
    const googleEmail = String(body.googleEmail || "").trim().toLowerCase();
    const aliasRef = adminDb.collection("investorLoginAliases").doc(googleEmail);
    const aliasSnapshot = await aliasRef.get();
    if (!aliasSnapshot.exists) {
      return NextResponse.json({ error: "This Google email has not been authorised by GrowVest." }, { status: 403 });
    }
    const alias = aliasSnapshot.data();
    if (alias.status !== "active" || alias.portalEnabled === false || alias.investorId !== actor.investorId) {
      return NextResponse.json({ error: "This Google email is not authorised for your Investor profile." }, { status: 403 });
    }
    if (alias.portalUid && alias.portalUid !== actor.uid) {
      return NextResponse.json({ error: "This Google email belongs to another portal account." }, { status: 409 });
    }

    const authUser = await adminAuth.getUser(actor.uid);
    const googleProvider = authUser.providerData.find((item) => item.providerId === "google.com");
    if (!googleProvider || String(googleProvider.email || "").toLowerCase() !== googleEmail) {
      return NextResponse.json({ error: "Google provider verification failed. Please try linking again." }, { status: 422 });
    }

    const userRef = adminDb.collection("users").doc(actor.uid);
    const investorRef = adminDb.collection("investors").doc(actor.investorId);
    const batch = adminDb.batch();
    batch.set(userRef, {
      authMethods: Array.from(new Set([...(actor.authMethods || []), "google"])),
      googleEmail,
      updatedAt: new Date()
    }, { merge: true });
    batch.set(investorRef, {
      portalGoogleEmail: googleEmail,
      portalAuthMethods: Array.from(new Set([...(alias.authMethods || actor.authMethods || []), "google"])),
      updatedAt: new Date()
    }, { merge: true });
    batch.set(aliasRef, {
      portalUid: actor.uid,
      linkedUid: actor.uid,
      requiresProviderLink: false,
      linkedAt: new Date(),
      updatedAt: new Date()
    }, { merge: true });
    await batch.commit();

    return NextResponse.json({ success: true, googleEmail });
  } catch (error) {
    console.error("Google provider link sync failed", error);
    return NextResponse.json({ error: error.message || "Google account could not be linked." }, { status: 500 });
  }
}
