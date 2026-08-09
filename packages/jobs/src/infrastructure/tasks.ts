import { asc, eq } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';

export type Task = typeof schema.tasks.$inferSelect;
export type TaskType = Task['type'];

export interface CreateTaskInput {
  organizationId: string;
  jobId: string;
  checklistTemplateItemId?: string | undefined;
  label: string;
  type: TaskType;
  isRequired?: boolean | undefined;
  sortOrder?: number | undefined;
}

export async function insertTask(tx: DatabaseClient, input: CreateTaskInput): Promise<Task> {
  const [task] = await tx
    .insert(schema.tasks)
    .values({
      organizationId: input.organizationId,
      jobId: input.jobId,
      checklistTemplateItemId: input.checklistTemplateItemId ?? null,
      label: input.label,
      type: input.type,
      isRequired: input.isRequired ?? true,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  if (!task) {
    throw new Error('Failed to insert task');
  }
  return task;
}

export async function findTaskById(tx: DatabaseClient, taskId: string): Promise<Task | undefined> {
  const [task] = await tx.select().from(schema.tasks).where(eq(schema.tasks.id, taskId)).limit(1);
  return task;
}

export async function listTasksForJob(tx: DatabaseClient, jobId: string): Promise<Task[]> {
  return tx
    .select()
    .from(schema.tasks)
    .where(eq(schema.tasks.jobId, jobId))
    .orderBy(asc(schema.tasks.sortOrder));
}

export interface CompleteTaskInput {
  responseValue?: unknown;
  completedByUserId: string;
  overrideReason?: string | undefined;
}

export async function completeTask(
  tx: DatabaseClient,
  taskId: string,
  input: CompleteTaskInput,
): Promise<Task | undefined> {
  const [task] = await tx
    .update(schema.tasks)
    .set({
      responseValue: input.responseValue ?? null,
      completedByUserId: input.completedByUserId,
      completedAt: new Date(),
      overrideReason: input.overrideReason ?? null,
      updatedAt: new Date(),
    })
    .where(eq(schema.tasks.id, taskId))
    .returning();
  return task;
}

/** Reopens a previously completed Task (clears completion attribution) — used when correcting a mistaken completion before the Job itself completes. */
export async function reopenTask(tx: DatabaseClient, taskId: string): Promise<Task | undefined> {
  const [task] = await tx
    .update(schema.tasks)
    .set({
      responseValue: null,
      completedByUserId: null,
      completedAt: null,
      overrideReason: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.tasks.id, taskId))
    .returning();
  return task;
}
