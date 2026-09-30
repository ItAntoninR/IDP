import { z } from "zod";
import { desc, eq, ilike } from "drizzle-orm";
import { db, schema } from "../db/index";
import { likePattern } from "../org-people";
import { audit } from "../support/audit";

export const archiveSearchSchema = z.object({ email: z.string().trim().min(3).max(320) });

export async function searchArchives(email: string) {
  return db
    .select({
      id: schema.deletedAccountArchive.id,
      name: schema.deletedAccountArchive.name,
      email: schema.deletedAccountArchive.email,
      reason: schema.deletedAccountArchive.reason,
      deletedAt: schema.deletedAccountArchive.deletedAt,
      expiresAt: schema.deletedAccountArchive.expiresAt,
    })
    .from(schema.deletedAccountArchive)
    .where(ilike(schema.deletedAccountArchive.email, likePattern(email)))
    .orderBy(desc(schema.deletedAccountArchive.deletedAt))
    .limit(50);
}

export async function exportArchive(id: string, actor: { actorId: string; impersonatedBy: string | null }) {
  const [archive] = await db.select().from(schema.deletedAccountArchive).where(eq(schema.deletedAccountArchive.id, id)).limit(1);
  if (!archive) return null;
  await audit({ ...actor, action: "archive.export", targetType: "user", targetId: archive.userId, metadata: { archiveId: id } });
  return {
    exportedAt: new Date().toISOString(),
    notice:
      "Archive conservée 1 an après la suppression du compte, uniquement pour répondre aux réquisitions des autorités (obligation légale). Toute consultation est tracée.",
    ...archive,
  };
}
