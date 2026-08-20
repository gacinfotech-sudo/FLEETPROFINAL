import { storage } from '../storage-mongodb';
import { ObjectId } from 'mongodb';

export async function cleanupDuplicateTemplates(tenantId?: string): Promise<{
  duplicateGroups: number;
  templatesDeleted: number;
  details: Array<{ key: string; kept: string; deleted: string[] }>;
}> {
  try {
    const db = storage.client?.db('fleetpro');
    const collection = db?.collection('whatsappTemplates');

    if (!collection) {
      throw new Error('Database not connected');
    }

    // Get all templates (optionally filtered by tenantId)
    const query: any = {};
    if (tenantId) query.tenantId = tenantId;

    const allTemplates = await collection.find(query).toArray();

    console.log(`[CLEANUP] Found ${allTemplates.length} templates`);

    // Group by tenantId + templateType + messageType + language
    const grouped: Record<string, any[]> = {};
    allTemplates.forEach((t) => {
      const key = `${t.tenantId}|${t.templateType}|${t.messageType}|${t.language}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(t);
    });

    const details: Array<{ key: string; kept: string; deleted: string[] }> = [];
    let totalDeleted = 0;
    let duplicateGroups = 0;

    // Find and delete duplicates
    for (const [key, templates] of Object.entries(grouped)) {
      if (templates.length > 1) {
        duplicateGroups++;
        console.log(`[CLEANUP] Found ${templates.length} copies of: ${key}`);

        // Keep the custom template if available, otherwise keep the most recent
        const customTemplate = templates.find((t) => t.isCustom);
        const keep =
          customTemplate ||
          templates.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0];

        const deletedIds: string[] = [];

        // Delete others
        for (const template of templates) {
          if (template._id.toString() !== keep._id.toString()) {
            await collection.deleteOne({ _id: new ObjectId(template._id) });
            deletedIds.push(`${template.name} (${template._id})`);
            totalDeleted++;
            console.log(`[CLEANUP] Deleted: ${template.name}`);
          }
        }

        details.push({
          key,
          kept: `${keep.name} (${keep._id})`,
          deleted: deletedIds,
        });
      }
    }

    console.log(
      `[CLEANUP] ✅ Cleaned up ${duplicateGroups} groups, deleted ${totalDeleted} templates`
    );

    return {
      duplicateGroups,
      templatesDeleted: totalDeleted,
      details,
    };
  } catch (error: any) {
    console.error('[CLEANUP] Error:', error.message);
    throw error;
  }
}
