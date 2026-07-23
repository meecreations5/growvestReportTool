import { adminDb } from "@/lib/server/firebaseAdmin";
import {
  DEFAULT_EMAIL_TEMPLATE_ID,
  createEmailTemplateSnapshot,
  getSystemEmailTemplate
} from "@/lib/constants/emailTemplates";

export async function getServerEmailTemplate(templateId = DEFAULT_EMAIL_TEMPLATE_ID) {
  const id = templateId || DEFAULT_EMAIL_TEMPLATE_ID;
  try {
    const snapshot = await adminDb.collection("emailTemplates").doc(id).get();
    if (snapshot.exists) {
      const value = { id: snapshot.id, ...snapshot.data() };
      const activeValue = value.status === "active" ? value : (value.draftConfig ? { ...value, ...value.draftConfig } : value);
      return {
        ...value,
        ...createEmailTemplateSnapshot(activeValue)
      };
    }
  } catch (error) {
    console.warn("Unable to load email template", id, error);
  }
  const builtIn = getSystemEmailTemplate(id) || getSystemEmailTemplate(DEFAULT_EMAIL_TEMPLATE_ID);
  return { ...builtIn, ...createEmailTemplateSnapshot(builtIn) };
}
