import { asc, eq } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';

export type ChecklistTemplate = typeof schema.checklistTemplates.$inferSelect;
export type ChecklistTemplateItem = typeof schema.checklistTemplateItems.$inferSelect;

/** tasks.md: "instantiated from a checklist_template/form_definition item at Job creation" — one template per Job Type. */
export async function findChecklistTemplateForJobType(
  tx: DatabaseClient,
  jobTypeId: string,
): Promise<ChecklistTemplate | undefined> {
  const [template] = await tx
    .select()
    .from(schema.checklistTemplates)
    .where(eq(schema.checklistTemplates.jobTypeId, jobTypeId))
    .limit(1);
  return template;
}

export async function listChecklistTemplateItems(
  tx: DatabaseClient,
  checklistTemplateId: string,
): Promise<ChecklistTemplateItem[]> {
  return tx
    .select()
    .from(schema.checklistTemplateItems)
    .where(eq(schema.checklistTemplateItems.checklistTemplateId, checklistTemplateId))
    .orderBy(asc(schema.checklistTemplateItems.sortOrder));
}
