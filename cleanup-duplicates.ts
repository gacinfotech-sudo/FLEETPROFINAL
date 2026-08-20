import mongoose from 'mongoose';

async function cleanupDuplicates() {
  try {
    console.log('\n═══════════════════════════════════════════');
    console.log('🗑️  DELETING DUPLICATE TEMPLATES');
    console.log('═══════════════════════════════════════════\n');

    await mongoose.connect('mongodb://127.0.0.1:27017/fleetpro');
    const db = mongoose.connection;
    const collection = db.collection('whatsappTemplates');

    // Get all templates
    const allTemplates = await collection.find({}).toArray();
    console.log(`📊 Total templates found: ${allTemplates.length}\n`);

    // Group by tenantId + templateType + messageType + language
    const grouped: Record<string, any[]> = {};
    allTemplates.forEach((t) => {
      const key = `${t.tenantId}|${t.templateType}|${t.messageType}|${t.language}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(t);
    });

    const details: any[] = [];
    let totalDeleted = 0;
    let duplicateGroups = 0;

    // Find and delete duplicates
    for (const [key, templates] of Object.entries(grouped)) {
      if (templates.length > 1) {
        duplicateGroups++;
        console.log(`\n⚠️  DUPLICATE GROUP: ${templates.length} copies`);
        const [tenantId, type, msgType, lang] = key.split('|');
        console.log(`   Type: ${type} | Message: ${msgType} | Language: ${lang}`);

        // Keep the custom template if available, otherwise keep the most recent
        const customTemplate = templates.find((t) => t.isCustom);
        const keep =
          customTemplate ||
          templates.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0];

        console.log(`   ✅ KEEPING: ${keep.name} (Custom: ${keep.isCustom})`);
        const deletedNames: string[] = [];

        // Delete others
        for (const template of templates) {
          if (template._id.toString() !== keep._id.toString()) {
            await collection.deleteOne({ _id: template._id });
            deletedNames.push(template.name);
            totalDeleted++;
            console.log(`   🗑️  DELETED: ${template.name}`);
          }
        }

        details.push({
          type,
          message: msgType,
          language: lang,
          kept: keep.name,
          deleted: deletedNames,
        });
      }
    }

    console.log(`\n═══════════════════════════════════════════`);
    console.log(`✨ CLEANUP COMPLETE`);
    console.log(`   Duplicate groups found: ${duplicateGroups}`);
    console.log(`   Templates deleted: ${totalDeleted}`);
    console.log(`   Remaining templates: ${allTemplates.length - totalDeleted}`);
    console.log('═══════════════════════════════════════════\n');

    if (details.length > 0) {
      console.log('📝 Summary:');
      details.forEach((d, i) => {
        console.log(`\n${i + 1}. ${d.type} → ${d.message}`);
        console.log(`   Kept: ${d.kept}`);
        console.log(`   Deleted: ${d.deleted.join(', ')}`);
      });
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

cleanupDuplicates();
