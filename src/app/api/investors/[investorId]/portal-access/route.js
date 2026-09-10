import { NextResponse } from "next/server";
import { adminAuth, adminDb, canStaffAccessRecord, verifyStaffRequest, appRequestErrorStatus } from "@/lib/server/firebaseAdmin";
import { investorUsernameToEmail, isValidInvestorUsername, normalizeInvestorUsername } from "@/lib/auth/investorIdentity";

export const runtime = "nodejs";

function clean(value = "") { return String(value || "").trim(); }
function normalizePhone(value = "") {
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}
function normalizeEmail(value = "") { return clean(value).toLowerCase(); }
function isValidEmail(value = "") { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value)); }
function membershipId(uid, investorId) { return `${uid}__${investorId}`; }
function normalizeRelationship(value = "") {
  const relation = clean(value).toLowerCase();
  return ["self", "spouse", "child", "parent", "sibling", "family", "other"].includes(relation) ? relation : "family";
}
function friendlyAuthError(error) {
  const messages = {
    "auth/email-already-exists": "This username is already linked to another Firebase account.",
    "auth/phone-number-already-exists": "This mobile number already belongs to another login account. Use Family Access to explicitly link this Investor to that login.",
    "auth/invalid-password": "The temporary password must be at least six characters.",
    "auth/invalid-phone-number": "Enter a valid mobile number with country code."
  };
  return messages[error?.code] || error?.message || "Unable to update Investor Portal access.";
}

async function userProfile(uid) {
  if (!uid) return null;
  const snapshot = await adminDb.collection("users").doc(uid).get();
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

async function accountProfiles(uid) {
  if (!uid) return [];
  const membershipSnapshot = await adminDb.collection("investorAccessMemberships").where("uid", "==", uid).where("status", "==", "active").get();
  const profile = await userProfile(uid);
  const ids = new Set([
    clean(profile?.investorId),
    ...(Array.isArray(profile?.accessibleInvestorIds) ? profile.accessibleInvestorIds.map(clean) : []),
    ...membershipSnapshot.docs.map((item) => clean(item.data()?.investorId))
  ].filter(Boolean));
  if (!ids.size) return [];
  const membershipMap = new Map(membershipSnapshot.docs.map((item) => [clean(item.data()?.investorId), item.data()]));
  const snapshots = await adminDb.getAll(...[...ids].map((id) => adminDb.collection("investors").doc(id)));
  return snapshots.filter((item) => item.exists).map((item) => {
    const row = item.data() || {};
    const membership = membershipMap.get(item.id) || {};
    return {
      investorId: item.id,
      fullName: row.fullName || row.name || "GrowVest Investor",
      clientCode: row.clientCode || "",
      relationship: item.id === (profile?.accountOwnerInvestorId || profile?.investorId) ? "self" : (membership.relationship || "family"),
      permission: membership.permission || "full",
      portalEnabled: row.portalEnabled !== false && row.status !== "inactive"
    };
  }).filter((item) => item.portalEnabled);
}

export async function GET(request, { params }) {
  try {
    const actor = await verifyStaffRequest(request);
    const { investorId } = await params;
    const snapshot = await adminDb.collection("investors").doc(investorId).get();
    if (!snapshot.exists) return NextResponse.json({ error: "Investor profile was not found." }, { status: 404 });
    const investor = { id: snapshot.id, ...snapshot.data() };
    if (!canStaffAccessRecord(actor, investor)) return NextResponse.json({ error: "You are not authorised to manage this Investor Portal account." }, { status: 403 });
    const uid = investor.portalUid || investor.investorPortalUid || "";
    const profiles = uid ? await accountProfiles(uid) : [];
    return NextResponse.json({ success: true, uid, shared: profiles.length > 1, profiles });
  } catch (error) {
    return NextResponse.json({ error: friendlyAuthError(error) }, { status: appRequestErrorStatus(error, 500) });
  }
}

export async function POST(request, { params }) {
  try {
    const actor = await verifyStaffRequest(request);
    const { investorId } = await params;
    const body = await request.json();
    const action = body.action || "enable";
    const investorRef = adminDb.collection("investors").doc(investorId);
    const investorSnapshot = await investorRef.get();
    if (!investorSnapshot.exists) return NextResponse.json({ error: "Investor profile was not found." }, { status: 404 });
    const investor = { id: investorSnapshot.id, ...investorSnapshot.data() };
    if (!canStaffAccessRecord(actor, investor)) return NextResponse.json({ error: "You are not authorised to manage this Investor Portal account." }, { status: 403 });

    if (action === "disable") {
      const portalUid = clean(investor.portalUid || investor.investorPortalUid);
      const batch = adminDb.batch();
      batch.set(investorRef, { portalEnabled: false, portalStatus: "disabled", portalUid: null, investorPortalUid: null, portalSharedAccess: false, updatedAt: new Date() }, { merge: true });

      if (!portalUid) {
        await batch.commit();
        return NextResponse.json({ success: true, status: "disabled" });
      }

      const account = await userProfile(portalUid);
      const memberships = await adminDb.collection("investorAccessMemberships").where("uid", "==", portalUid).where("status", "==", "active").get();
      const remainingIds = new Set([
        ...(Array.isArray(account?.accessibleInvestorIds) ? account.accessibleInvestorIds.map(clean) : []),
        ...memberships.docs.map((item) => clean(item.data()?.investorId))
      ].filter((id) => id && id !== investorId));

      batch.set(adminDb.collection("investorAccessMemberships").doc(membershipId(portalUid, investorId)), {
        uid: portalUid, investorId, status: "inactive", disabledAt: new Date(), disabledByUid: actor.uid, updatedAt: new Date()
      }, { merge: true });

      if (remainingIds.size) {
        const ids = [...remainingIds];
        const nextPrimary = ids.includes(clean(account?.investorId)) ? clean(account?.investorId) : ids[0];
        batch.set(adminDb.collection("users").doc(portalUid), {
          status: "active", portalEnabled: true, investorId: nextPrimary, accessibleInvestorIds: ids, householdAccessEnabled: ids.length > 1, updatedAt: new Date()
        }, { merge: true });
        try { await adminAuth.updateUser(portalUid, { disabled: false }); } catch (error) { if (error?.code !== "auth/user-not-found") throw error; }
        if (investor.portalUsername) {
          const usernameRef = adminDb.collection("usernames").doc(investor.portalUsername);
          const usernameSnap = await usernameRef.get();
          if (usernameSnap.exists && usernameSnap.data()?.uid === portalUid) batch.set(usernameRef, { investorId: nextPrimary, status: "active", updatedAt: new Date() }, { merge: true });
        }
      } else {
        batch.set(adminDb.collection("users").doc(portalUid), { status: "inactive", portalEnabled: false, accessibleInvestorIds: [], householdAccessEnabled: false, updatedAt: new Date() }, { merge: true });
        try { await adminAuth.updateUser(portalUid, { disabled: true }); } catch (error) { if (error?.code !== "auth/user-not-found") throw error; }
        if (investor.portalUsername) batch.set(adminDb.collection("usernames").doc(investor.portalUsername), { status: "inactive", updatedAt: new Date() }, { merge: true });
      }

      if (investor.portalGoogleEmail) {
        const aliasRef = adminDb.collection("investorLoginAliases").doc(investor.portalGoogleEmail);
        const aliasSnap = await aliasRef.get();
        if (aliasSnap.exists) {
          const alias = aliasSnap.data() || {};
          const aliasIds = (Array.isArray(alias.investorIds) ? alias.investorIds : [alias.investorId]).map(clean).filter((id) => id && id !== investorId);
          batch.set(aliasRef, {
            investorIds: aliasIds,
            investorId: aliasIds[0] || "",
            status: aliasIds.length ? "active" : "inactive",
            portalEnabled: Boolean(aliasIds.length),
            updatedAt: new Date()
          }, { merge: true });
        }
      }

      await batch.commit();
      return NextResponse.json({ success: true, status: "disabled", sharedAccountStillActive: remainingIds.size > 0 });
    }

    const enableUsername = Boolean(body.enableUsername);
    const enableMobile = Boolean(body.enableMobile);
    const enableGoogle = Boolean(body.enableGoogle);
    const allowSharedAccess = Boolean(body.allowSharedAccess);
    const relationship = normalizeRelationship(body.relationship || (investor.portalUid ? investor.portalRelationship : "self"));
    if (!enableUsername && !enableMobile && !enableGoogle) return NextResponse.json({ error: "Enable at least one Investor login method." }, { status: 422 });

    const username = normalizeInvestorUsername(body.username || investor.portalUsername || investor.clientCode || "");
    if (enableUsername && !isValidInvestorUsername(username)) return NextResponse.json({ error: "Username must be 5 to 30 characters and use lowercase letters, numbers, dots, underscores or hyphens." }, { status: 422 });
    const internalEmail = enableUsername ? investorUsernameToEmail(username) : "";
    const mobile = enableMobile ? normalizePhone(body.mobile || investor.contactNo || investor.mobile || "") : "";
    if (enableMobile && !mobile) return NextResponse.json({ error: "A registered mobile number is required for OTP login." }, { status: 422 });
    const googleEmail = enableGoogle ? normalizeEmail(body.googleEmail || investor.email || "") : "";
    if (enableGoogle && !isValidEmail(googleEmail)) return NextResponse.json({ error: "A valid authorised Google email is required." }, { status: 422 });

    let portalUid = clean(investor.portalUid || investor.investorPortalUid);
    let sharedDetected = false;
    let sharedSource = "";
    let candidateProfile = null;

    if (enableMobile && mobile) {
      try {
        const existingPhoneUser = await adminAuth.getUserByPhoneNumber(mobile);
        if (!portalUid || existingPhoneUser.uid !== portalUid) {
          const existingProfile = await userProfile(existingPhoneUser.uid);
          if (!existingProfile || existingProfile.role !== "investor") return NextResponse.json({ error: "This mobile number belongs to another login account and cannot be shared here." }, { status: 409 });
          if (!allowSharedAccess) {
            return NextResponse.json({
              error: `This mobile number is already used by ${existingProfile.fullName || "another GrowVest Investor"}. Confirm Family Access to link this Investor to the same login.`,
              sharedAccessAvailable: true,
              sharedAccountName: existingProfile.fullName || "Existing family login",
              sharedVia: "mobile"
            }, { status: 409 });
          }
          portalUid = existingPhoneUser.uid;
          candidateProfile = existingProfile;
          sharedDetected = clean(existingProfile.investorId) !== investorId;
          sharedSource = "mobile";
        }
      } catch (error) {
        if (error?.code !== "auth/user-not-found") throw error;
      }
    }

    let aliasSnapshot = null;
    let alias = null;
    if (enableGoogle && googleEmail) {
      const aliasRef = adminDb.collection("investorLoginAliases").doc(googleEmail);
      aliasSnapshot = await aliasRef.get();
      alias = aliasSnapshot.exists ? aliasSnapshot.data() : null;
      const aliasIds = (Array.isArray(alias?.investorIds) ? alias.investorIds : [alias?.investorId]).map(clean).filter(Boolean);
      const usedByDifferentInvestor = alias?.status === "active" && aliasIds.some((id) => id !== investorId);
      if (usedByDifferentInvestor) {
        const aliasUid = clean(alias.portalUid || alias.linkedUid);
        if (!allowSharedAccess) {
          return NextResponse.json({
            error: "This Google email is already authorised for another Investor. Confirm Family Access to use the same login for this Investor too.",
            sharedAccessAvailable: true,
            sharedAccountName: alias.fullName || "Existing family login",
            sharedVia: "google"
          }, { status: 409 });
        }
        if (!aliasUid && !portalUid) return NextResponse.json({ error: "Set up the family login with Mobile OTP or Username/Password first, then link this Google email to the shared account." }, { status: 422 });
        if (portalUid && aliasUid && portalUid !== aliasUid) return NextResponse.json({ error: "The mobile number and Google email belong to different GrowVest login accounts. Resolve the account mapping before enabling access." }, { status: 409 });
        portalUid = portalUid || aliasUid;
        candidateProfile = candidateProfile || (portalUid ? await userProfile(portalUid) : null);
        sharedDetected = true;
        sharedSource = sharedSource || "google";
      }
    }

    if (enableUsername) {
      const usernameSnapshot = await adminDb.collection("usernames").doc(username).get();
      if (usernameSnapshot.exists && usernameSnapshot.data().investorId !== investorId && usernameSnapshot.data().uid !== portalUid) {
        return NextResponse.json({ error: "This Investor username is already in use." }, { status: 409 });
      }
    }

    let existingAuthUser = null;
    let existingProfile = candidateProfile;
    if (portalUid) {
      try { existingAuthUser = await adminAuth.getUser(portalUid); }
      catch (error) { if (error?.code !== "auth/user-not-found") throw error; portalUid = ""; }
      if (!existingProfile && portalUid) existingProfile = await userProfile(portalUid);
    }

    if (existingProfile?.role && existingProfile.role !== "investor") return NextResponse.json({ error: "The matching login belongs to a staff account and cannot be used for Investor family access." }, { status: 409 });
    const existingPrimaryInvestorId = clean(existingProfile?.investorId);
    sharedDetected = sharedDetected || Boolean(existingPrimaryInvestorId && existingPrimaryInvestorId !== investorId);

    if (sharedDetected && !allowSharedAccess) {
      return NextResponse.json({ error: "This login is already linked to another Investor. Confirm Family Access to add this profile.", sharedAccessAvailable: true, sharedAccountName: existingProfile?.fullName || "Existing family login", sharedVia: sharedSource || "account" }, { status: 409 });
    }

    if (sharedDetected && enableUsername && existingAuthUser?.email && existingAuthUser.email !== internalEmail) {
      return NextResponse.json({ error: "A shared family account can have only one GrowVest username/password. Turn off Username & Password for this additional family profile; it will use the existing household credentials." }, { status: 422 });
    }

    const temporaryPassword = String(body.temporaryPassword || "");
    const addingUsernameLogin = enableUsername && (!portalUid || !Array.isArray(existingProfile?.authMethods) || !existingProfile.authMethods.includes("username_password"));
    if (!sharedDetected && addingUsernameLogin && temporaryPassword.length < 6) return NextResponse.json({ error: "Enter a temporary password of at least six characters." }, { status: 422 });

    let created = false;
    if (!portalUid) {
      const createdUser = await adminAuth.createUser({
        displayName: investor.fullName || "GrowVest Investor",
        disabled: false,
        ...(enableUsername ? { email: internalEmail, password: temporaryPassword } : {}),
        ...(enableMobile ? { phoneNumber: mobile } : {})
      });
      portalUid = createdUser.uid;
      existingAuthUser = createdUser;
      created = true;
    } else if (!sharedDetected) {
      const update = { disabled: false, displayName: investor.fullName || existingAuthUser?.displayName || "GrowVest Investor" };
      if (enableUsername) update.email = internalEmail;
      else if (existingAuthUser?.email?.endsWith("@investor.growvest.internal")) update.email = null;
      if (enableMobile) update.phoneNumber = mobile;
      else if (existingAuthUser?.phoneNumber) update.phoneNumber = null;
      if (temporaryPassword) update.password = temporaryPassword;
      await adminAuth.updateUser(portalUid, update);
    } else {
      await adminAuth.updateUser(portalUid, { disabled: false });
    }

    const requestedMethods = [enableUsername ? "username_password" : null, enableMobile ? "phone" : null, enableGoogle ? "google" : null].filter(Boolean);
    const existingMethods = Array.isArray(existingProfile?.authMethods) ? existingProfile.authMethods : [];
    const authMethods = sharedDetected ? Array.from(new Set([...existingMethods, ...requestedMethods])) : requestedMethods;
    const primaryInvestorId = existingPrimaryInvestorId || investorId;
    const existingAccessIds = Array.isArray(existingProfile?.accessibleInvestorIds) ? existingProfile.accessibleInvestorIds.map(clean).filter(Boolean) : [];
    const accessibleInvestorIds = Array.from(new Set([primaryInvestorId, ...existingAccessIds, investorId].filter(Boolean)));

    const batch = adminDb.batch();
    const userRef = adminDb.collection("users").doc(portalUid);
    const userData = sharedDetected ? {
      status: "active", role: "investor", portalEnabled: true, investorId: primaryInvestorId,
      accountOwnerInvestorId: existingProfile?.accountOwnerInvestorId || primaryInvestorId,
      accessibleInvestorIds, householdAccessEnabled: accessibleInvestorIds.length > 1,
      authMethods, authMethod: authMethods.join(","), updatedAt: new Date()
    } : {
      uid: portalUid,
      fullName: investor.fullName || "GrowVest Investor",
      email: investor.email || "",
      authEmail: enableUsername ? internalEmail : "",
      mobile: mobile || normalizePhone(investor.contactNo || investor.mobile || ""),
      role: "investor", status: "active", investorId, accountOwnerInvestorId: investorId, accessibleInvestorIds,
      householdAccessEnabled: accessibleInvestorIds.length > 1,
      clientCode: investor.clientCode || "", username: enableUsername ? username : "",
      authMethods: authMethods.filter((item) => item !== "google"), authMethod: authMethods.filter((item) => item !== "google").join(","),
      portalEnabled: true, mustChangePassword: Boolean(enableUsername && (created || temporaryPassword)),
      createdByUid: actor.uid, updatedAt: new Date(), ...(created ? { createdAt: new Date() } : {})
    };
    batch.set(userRef, userData, { merge: true });

    // Membership documents are the server-side authority for household profile switching.
    batch.set(adminDb.collection("investorAccessMemberships").doc(membershipId(portalUid, investorId)), {
      uid: portalUid, investorId,
      relationship: sharedDetected ? relationship : "self",
      permission: "full", status: "active", isPrimary: investorId === primaryInvestorId,
      source: sharedDetected ? `shared_${sharedSource || "family"}` : "direct",
      grantedByUid: actor.uid, grantedAt: new Date(), updatedAt: new Date()
    }, { merge: true });
    if (primaryInvestorId && primaryInvestorId !== investorId) {
      batch.set(adminDb.collection("investorAccessMemberships").doc(membershipId(portalUid, primaryInvestorId)), {
        uid: portalUid, investorId: primaryInvestorId, relationship: "self", permission: "full", status: "active", isPrimary: true,
        source: "direct", updatedAt: new Date()
      }, { merge: true });
    }

    batch.set(investorRef, {
      portalUid, investorPortalUid: portalUid, portalEnabled: true, portalStatus: "active",
      portalUsername: sharedDetected ? (investor.portalUsername || "") : (enableUsername ? username : ""),
      portalMobile: enableMobile ? mobile : (investor.portalMobile || ""),
      portalGoogleEmail: enableGoogle ? googleEmail : (investor.portalGoogleEmail || ""),
      portalAuthMethods: authMethods,
      portalSharedAccess: sharedDetected,
      portalRelationship: sharedDetected ? relationship : "self",
      portalEnabledAt: investor.portalEnabledAt || new Date(), portalEnabledByUid: actor.uid, updatedAt: new Date()
    }, { merge: true });

    if (!sharedDetected) {
      if (investor.portalUsername && investor.portalUsername !== username) batch.set(adminDb.collection("usernames").doc(investor.portalUsername), { status: "inactive", updatedAt: new Date() }, { merge: true });
      if (enableUsername) batch.set(adminDb.collection("usernames").doc(username), { uid: portalUid, investorId: primaryInvestorId, status: "active", updatedAt: new Date() }, { merge: true });
    }

    if (enableGoogle) {
      const aliasRef = adminDb.collection("investorLoginAliases").doc(googleEmail);
      const currentAlias = alias || {};
      const aliasIds = Array.from(new Set([...(Array.isArray(currentAlias.investorIds) ? currentAlias.investorIds : [currentAlias.investorId]).map(clean).filter(Boolean), investorId]));
      batch.set(aliasRef, {
        email: googleEmail, investorId: currentAlias.investorId || primaryInvestorId || investorId, investorIds: aliasIds,
        fullName: existingProfile?.fullName || investor.fullName || "GrowVest Investor",
        clientCode: existingProfile?.clientCode || investor.clientCode || "",
        mobile: existingProfile?.mobile || normalizePhone(investor.contactNo || investor.mobile || ""),
        advisorUid: investor.advisorUid || investor.assignedAdvisorUid || actor.uid,
        portalUid, linkedUid: currentAlias.linkedUid || null, requiresProviderLink: true,
        status: "active", portalEnabled: true, updatedAt: new Date()
      }, { merge: true });
    }

    const activityRef = adminDb.collection("activityLogs").doc();
    batch.set(activityRef, {
      recordType: "investor", recordId: investorId, investorId,
      advisorUid: investor.advisorUid || investor.assignedAdvisorUid || actor.uid,
      action: sharedDetected ? "investor_family_access_linked" : (investor.portalEnabled ? "investor_portal_updated" : "investor_portal_enabled"),
      title: sharedDetected ? "Investor linked to family portal access" : (investor.portalEnabled ? "Investor Portal access updated" : "Investor Portal access enabled"),
      description: sharedDetected
        ? `${actor.fullName || actor.email} linked ${investor.fullName} to an existing family Investor login.`
        : `${actor.fullName || actor.email} ${investor.portalEnabled ? "updated" : "enabled"} portal access for ${investor.fullName}.`,
      metadata: { authMethods, sharedDetected, relationship: sharedDetected ? relationship : "self", sharedSource },
      createdByUid: actor.uid, createdByName: actor.fullName || actor.email, createdAt: new Date()
    });

    await batch.commit();
    return NextResponse.json({
      success: true, portalUid, username: enableUsername ? username : null, googleEmail: enableGoogle ? googleEmail : null,
      authMethods, status: "active", created, sharedAccess: sharedDetected, relationship: sharedDetected ? relationship : "self",
      accessibleInvestorIds, googleLinkRequired: Boolean(enableGoogle)
    });
  } catch (error) {
    console.error("Investor Portal access update failed", error);
    return NextResponse.json({ error: friendlyAuthError(error) }, { status: appRequestErrorStatus(error, 500) });
  }
}
