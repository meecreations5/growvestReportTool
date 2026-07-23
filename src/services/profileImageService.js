import { updateProfile } from "firebase/auth";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase/client";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

function safeFileName(name) {
  return String(name || "profile-image")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "") || "profile-image";
}

export function validateProfileImage(file) {
  if (!file) return "Select a profile image.";
  if (!ALLOWED_TYPES.includes(file.type)) return "Use a PNG, JPG or WebP image.";
  if (file.size > MAX_BYTES) return "Profile image must be 5 MB or smaller.";
  return "";
}

export async function uploadProfileImage({ uid, file, onProgress }) {
  const validationError = validateProfileImage(file);
  if (validationError) throw new Error(validationError);
  if (!uid) throw new Error("User profile is unavailable.");

  const path = `profile-images/${uid}/${Date.now()}-${safeFileName(file.name)}`;
  const task = uploadBytesResumable(ref(storage, path), file, {
    contentType: file.type,
    customMetadata: { uid }
  });

  const photoURL = await new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
      reject,
      async () => resolve(await getDownloadURL(task.snapshot.ref))
    );
  });

  await updateDoc(doc(db, "users", uid), {
    photoURL,
    updatedAt: serverTimestamp()
  });

  if (auth.currentUser?.uid === uid) {
    try {
      await updateProfile(auth.currentUser, { photoURL });
    } catch (error) {
      console.warn("Firebase Auth profile image could not be updated", error);
    }
  }

  return photoURL;
}
