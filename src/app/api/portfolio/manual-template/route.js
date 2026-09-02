import path from "node:path";
import { readFile } from "node:fs/promises";
import { appRequestErrorStatus, verifyStaffRequest } from "@/lib/server/firebaseAdmin";

export const runtime = "nodejs";

const TEMPLATE_FILE = "GrowVest_Manual_Investment_Template_v0.33.2.xlsx";

export async function GET(request) {
  try {
    const actor = await verifyStaffRequest(request);
    if (!["super_admin", "admin"].includes(actor.role)) {
      return Response.json({ error: "Admin access is required for Manual Portfolio administration." }, { status: 403 });
    }

    const filePath = path.join(process.cwd(), "public", "templates", TEMPLATE_FILE);
    const buffer = await readFile(filePath);

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${TEMPLATE_FILE}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    console.error("Manual investment template download failed", error);
    return Response.json(
      { error: error?.message || "Unable to prepare the Manual Investment template." },
      { status: appRequestErrorStatus(error, 500) }
    );
  }
}
