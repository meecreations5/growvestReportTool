import { NextResponse } from "next/server";
import { adminAuth, adminDb, canStaffAccessRecord, verifyStaffRequest,
  appRequestErrorStatus
} from "@/lib/server/firebaseAdmin";
import { investorUsernameToEmail, isValidInvestorUsername, normalizeInvestorUsername } from "@/lib/auth/investorIdentity";

export const runtime = "nodejs";

function normalizePhone(value = "") {
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function isValidEmail(value = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function friendlyAuthError(error) {
  const messages = {
    "auth/email-already-exists": "This username is already linked to another Firebase account.",
    "auth/phone-number-already-exists": "This mobile number is already linked to another Firebase account.",
    "auth/invalid-password": "The temporary password must be at least six characters.",
    "auth/invalid-phone-number": "Enter a valid mobile number with country code."
  };
  return messages[error?.code] || error?.message || "Unable to update Investor Portal access.";
}

async function disableInvestorUsers(investorId) {
  const usersSnapshot = await adminDb.collection("users").where("investorId", "==", investorId).get();
  await Promise.all(usersSnapshot.docs.map(async (item) => {
    try {
      await adminAuth.updateUser(item.id, { disabled: true });
    } catch (error) {
      if (error?.code !== "auth/user-not-found") throw error;
    }
  }));
  return usersSnapshot.docs;
}

async function removeDuplicateGoogleAccount(googleEmail, canonicalUid, investorId) {
  if (!googleEmail || !canonicalUid) return null;
  let googleUser;
  try {
    googleUser = await adminAuth.getUserByEmail(googleEmail);
  } catch (error) {
    if (error?.code === "auth/user-not-found") return null;
    throw error;
  }

  if (googleUser.uid === canonicalUid) return null;
  const duplicateProfileRef = adminDb.collection("users").doc(googleUser.uid);
  const duplicateProfileSnapshot = await duplicateProfileRef.get();
  const duplicateProfile = duplicateProfileSnapshot.exists ? duplicateProfileSnapshot.data() : null;
  if (duplicateProfile?.investorId && duplicateProfile.investorId !== investorId) {
    throw new Error("This Google email is linked to a different Investor account.");
  }

  await adminAuth.deleteUser(googleUser.uid);
  if (duplicateProfileSnapshot.exists) await duplicateProfileRef.delete();
  return googleUser.uid;
}

export async function POST(request, { params }) {
  try {
    const actor = await verifyStaffRequest(request);
    const { investorId } = await params;
    const body = await request.json();
    const action = body.action || "enable";
    const investorRef = adminDb.collection("investors").doc(investorId);
    const investorSnapshot = await investorRef.get();

    if (!investorSnapshot.exists) {
      return NextResponse.json({ error: "Investor profile was not found." }, { status: 404 });
    }

    const investor = { id: investorSnapshot.id, ...investorSnapshot.data() };
    if (!canStaffAccessRecord(actor, investor)) {
      return NextResponse.json({ error: "You are not authorised to manage this Investor Portal account." }, { status: 403 });
    }

    if (action === "disable") {
      const linkedUsers = await disableInvestorUsers(investorId);
      const batch = adminDb.batch();
      batch.set(investorRef, {
        portalEnabled: false,
        portalStatus: "disabled",
        updatedAt: new Date()
      }, { merge: true });

      linkedUsers.forEach((item) => {
        batch.set(item.ref, { status: "inactive", portalEnabled: false, updatedAt: new Date() }, { merge: true });
      });

      if (investor.portalUsername) {
        batch.set(adminDb.collection("usernames").doc(investor.portalUsername), { status: "inactive", updatedAt: new Date() }, { merge: true });
      }
      if (investor.portalGoogleEmail) {
        batch.set(adminDb.collection("investorLoginAliases").doc(investor.portalGoogleEmail), { status: "inactive", portalEnabled: false, updatedAt: new Date() }, { merge: true });
      }
      await batch.commit();
      return NextResponse.json({ success: true, status: "disabled" });
    }

    const enableUsername = Boolean(body.enableUsername);
    const enableMobile = Boolean(body.enableMobile);
    const enableGoogle = Boolean(body.enableGoogle);

    if (!enableUsername && !enableMobile && !enableGoogle) {
      return NextResponse.json({ error: "Enable at least one Investor login method." }, { status: 422 });
    }

    const username = normalizeInvestorUsername(body.username || investor.portalUsername || investor.clientCode || "");
    if (enableUsername && !isValidInvestorUsername(username)) {
      return NextResponse.json({ error: "Username must be 5 to 30 characters and use lowercase letters, numbers, dots, underscores or hyphens." }, { status: 422 });
    }

    const internalEmail = enableUsername ? investorUsernameToEmail(username) : undefined;
    const mobile = enableMobile ? normalizePhone(body.mobile || investor.contactNo || investor.mobile || "") : undefined;
    if (enableMobile && !mobile) {
      return NextResponse.json({ error: "A registered mobile number is required for OTP login." }, { status: 422 });
    }

    const googleEmail = enableGoogle ? normalizeEmail(body.googleEmail || investor.email || "") : "";
    if (enableGoogle && !isValidEmail(googleEmail)) {
      return NextResponse.json({ error: "A valid authorised Google email is required." }, { status: 422 });
    }

    const temporaryPassword = String(body.temporaryPassword || "");
    const existingAuthMethods = investor.portalAuthMethods || [];
    const addingUsernameLogin = enableUsername && (!investor.portalUid || !existingAuthMethods.includes("username_password"));
    if (addingUsernameLogin && temporaryPassword.length < 6) {
      return NextResponse.json({ error: "Enter a temporary password of at least six characters." }, { status: 422 });
    }

    if (enableUsername) {
      const usernameSnapshot = await adminDb.collection("usernames").doc(username).get();
      if (usernameSnapshot.exists && usernameSnapshot.data().investorId !== investorId) {
        return NextResponse.json({ error: "This Investor username is already in use." }, { status: 409 });
      }
    }

    if (enableGoogle) {
      const aliasSnapshot = await adminDb.collection("investorLoginAliases").doc(googleEmail).get();
      if (aliasSnapshot.exists && aliasSnapshot.data().investorId !== investorId && aliasSnapshot.data().status === "active") {
        return NextResponse.json({ error: "This Google email is already authorised for another Investor." }, { status: 409 });
      }
    }

    const needsPrimaryFirebaseUser = enableUsername || enableMobile;
    let portalUid = investor.portalUid || null;
    let created = false;

    if (needsPrimaryFirebaseUser) {
      if (portalUid) {
        const update = {
          disabled: false,
          displayName: investor.fullName || "GrowVest Investor",
          email: enableUsername ? internalEmail : null,
          phoneNumber: enableMobile ? mobile : null
        };
        if (temporaryPassword) update.password = temporaryPassword;
        await adminAuth.updateUser(portalUid, update);
      } else {
        const createdUser = await adminAuth.createUser({
          displayName: investor.fullName || "GrowVest Investor",
          disabled: false,
          ...(enableUsername ? { email: internalEmail, password: temporaryPassword } : {}),
          ...(enableMobile ? { phoneNumber: mobile } : {})
        });
        portalUid = createdUser.uid;
        created = true;
      }
    } else if (portalUid) {
      try {
        await adminAuth.updateUser(portalUid, { disabled: true });
      } catch (error) {
        if (error?.code !== "auth/user-not-found") throw error;
      }
    }

    const authMethods = [
      enableUsername ? "username_password" : null,
      enableMobile ? "phone" : null,
      enableGoogle ? "google" : null
    ].filter(Boolean);

    // A Google popup can create a second Firebase user when the provider has
    // not yet been linked. Clean up only duplicates that belong to this same Investor.
    const removedDuplicateGoogleUid = enableGoogle && portalUid
      ? await removeDuplicateGoogleAccount(googleEmail, portalUid, investorId)
      : null;

    const batch = adminDb.batch();

    if (portalUid && needsPrimaryFirebaseUser) {
      const primaryMethods = authMethods.filter((item) => item !== "google");
      const userProfileData = {
        uid: portalUid,
        fullName: investor.fullName || "GrowVest Investor",
        email: investor.email || "",
        authEmail: enableUsername ? internalEmail : "",
        mobile: mobile || normalizePhone(investor.contactNo || investor.mobile || ""),
        role: "investor",
        status: "active",
        investorId,
        clientCode: investor.clientCode || "",
        username: enableUsername ? username : "",
        authMethods: primaryMethods,
        authMethod: primaryMethods.join(","),
        portalEnabled: true,
        mustChangePassword: Boolean(enableUsername && (created || temporaryPassword)),
        createdByUid: actor.uid,
        updatedAt: new Date()
      };
      if (created) userProfileData.createdAt = new Date();
      batch.set(adminDb.collection("users").doc(portalUid), userProfileData, { merge: true });
    } else if (portalUid) {
      batch.set(adminDb.collection("users").doc(portalUid), { status: "inactive", portalEnabled: false, updatedAt: new Date() }, { merge: true });
    }

    batch.set(investorRef, {
      portalUid: needsPrimaryFirebaseUser ? portalUid : null,
      investorPortalUid: needsPrimaryFirebaseUser ? portalUid : null,
      portalEnabled: true,
      portalStatus: "active",
      portalUsername: enableUsername ? username : "",
      portalMobile: mobile || "",
      portalGoogleEmail: googleEmail,
      portalAuthMethods: authMethods,
      portalEnabledAt: investor.portalEnabledAt || new Date(),
      portalEnabledByUid: actor.uid,
      updatedAt: new Date()
    }, { merge: true });

    if (investor.portalUsername && investor.portalUsername !== username) {
      batch.set(adminDb.collection("usernames").doc(investor.portalUsername), { status: "inactive", updatedAt: new Date() }, { merge: true });
    }
    if (enableUsername) {
      batch.set(adminDb.collection("usernames").doc(username), { uid: portalUid, investorId, status: "active", updatedAt: new Date() }, { merge: true });
    }

    if (investor.portalGoogleEmail && investor.portalGoogleEmail !== googleEmail) {
      batch.set(adminDb.collection("investorLoginAliases").doc(investor.portalGoogleEmail), { status: "inactive", portalEnabled: false, updatedAt: new Date() }, { merge: true });
    }
    if (enableGoogle) {
      batch.set(adminDb.collection("investorLoginAliases").doc(googleEmail), {
        email: googleEmail,
        investorId,
        fullName: investor.fullName || "GrowVest Investor",
        clientCode: investor.clientCode || "",
        mobile: normalizePhone(investor.contactNo || investor.mobile || ""),
        advisorUid: investor.advisorUid || investor.assignedAdvisorUid || actor.uid,
        portalUid: needsPrimaryFirebaseUser ? portalUid : null,
        linkedUid: null,
        requiresProviderLink: Boolean(needsPrimaryFirebaseUser),
        status: "active",
        portalEnabled: true,
        updatedAt: new Date()
      }, { merge: true });
    }

    const activityRef = adminDb.collection("activityLogs").doc();
    batch.set(activityRef, {
      recordType: "investor",
      recordId: investorId,
      investorId,
      advisorUid: investor.advisorUid || investor.assignedAdvisorUid || actor.uid,
      action: investor.portalEnabled ? "investor_portal_updated" : "investor_portal_enabled",
      title: investor.portalEnabled ? "Investor Portal access updated" : "Investor Portal access enabled",
      description: `${actor.fullName || actor.email} ${investor.portalEnabled ? "updated" : "enabled"} portal access for ${investor.fullName}.`,
      metadata: {
        authMethods,
        username: enableUsername ? username : "",
        mobileEnabled: enableMobile,
        googleEmail: enableGoogle ? googleEmail : "",
        removedDuplicateGoogleUid: removedDuplicateGoogleUid || ""
      },
      createdByUid: actor.uid,
      createdByName: actor.fullName || actor.email,
      createdAt: new Date()
    });

    await batch.commit();
    return NextResponse.json({
      success: true,
      portalUid: needsPrimaryFirebaseUser ? portalUid : null,
      username: enableUsername ? username : null,
      googleEmail: enableGoogle ? googleEmail : null,
      authMethods,
      status: "active",
      created,
      googleLinkRequired: Boolean(enableGoogle && needsPrimaryFirebaseUser),
      removedDuplicateGoogleUid: removedDuplicateGoogleUid || null
    });
  } catch (error) {
    console.error("Investor Portal access update failed", error);
    return NextResponse.json({ error: friendlyAuthError(error) }, { status: appRequestErrorStatus(error, 500) });
  }
}
