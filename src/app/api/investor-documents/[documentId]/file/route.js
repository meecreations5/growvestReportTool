import { NextResponse } from "next/server";
import {
  adminBucket,
  adminDb,
  verifyAppRequest,
  appRequestErrorStatus
} from "@/lib/server/firebaseAdmin";

export const runtime = "nodejs";

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

function cleanHeaderFileName(value = "GrowVest-document") {
  return String(value || "GrowVest-document")
    .replace(/[\r\n"]/g, "")
    .replace(/[^a-zA-Z0-9._ -]+/g, "-")
    .trim() || "GrowVest-document";
}

function inferMimeType(fileName = "") {
  const lower = String(fileName || "").toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

async function canActorReadDocument(actor, documentRecord) {
  if (["super_admin", "admin"].includes(actor.role)) return true;

  if (actor.role === "investor") {
    return actor.portalEnabled !== false
      && Boolean(actor.investorId)
      && actor.investorId === documentRecord.investorId
      && documentRecord.investorVisible === true;
  }

  if (actor.role !== "advisor" || !documentRecord.investorId) return false;

  const investorSnapshot = await adminDb.collection("investors").doc(documentRecord.investorId).get();
  if (!investorSnapshot.exists) return false;
  const investor = investorSnapshot.data();
  const ownsInvestor = [investor.assignedAdvisorUid, investor.advisorUid].includes(actor.uid);
  const ownsDocument = !documentRecord.advisorUid || documentRecord.advisorUid === actor.uid;
  return ownsInvestor && ownsDocument;
}

export async function GET(request, { params }) {
  try {
    const actor = await verifyAppRequest(request);
    const { documentId } = await params;
    if (!documentId) return NextResponse.json({ error: "Document ID is required." }, { status: 400 });

    const snapshot = await adminDb.collection("investorDocuments").doc(documentId).get();
    if (!snapshot.exists) return NextResponse.json({ error: "Document record was not found." }, { status: 404 });

    const documentRecord = { id: snapshot.id, ...snapshot.data() };
    if (!(await canActorReadDocument(actor, documentRecord))) {
      return NextResponse.json({ error: "You are not authorised to view this document." }, { status: 403 });
    }

    if (!documentRecord.storagePath) {
      return NextResponse.json({ error: "No file has been uploaded for this document." }, { status: 404 });
    }

    const expectedPrefix = `investor-documents/${documentRecord.investorId}/${documentId}/`;
    if (!String(documentRecord.storagePath).startsWith(expectedPrefix)) {
      return NextResponse.json({ error: "The document file reference is invalid." }, { status: 400 });
    }

    const file = adminBucket.file(documentRecord.storagePath);
    const [[buffer], [metadata]] = await Promise.all([
      file.download(),
      file.getMetadata()
    ]);

    if (buffer.length > MAX_DOCUMENT_BYTES) {
      return NextResponse.json({ error: "This document is larger than the supported 10 MB limit." }, { status: 413 });
    }

    const fileName = cleanHeaderFileName(documentRecord.fileName || metadata.name?.split("/").pop());
    const mimeType = documentRecord.mimeType || metadata.contentType || inferMimeType(fileName);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    console.error("Investor document file read failed", error);
    return NextResponse.json(
      { error: error?.message || "Unable to open the document." },
      { status: appRequestErrorStatus(error, 500) }
    );
  }
}
