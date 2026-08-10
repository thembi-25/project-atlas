import { desc, eq } from 'drizzle-orm';
import { schema, type DatabaseClient } from '@atlas/database';

export type CreditNote = typeof schema.creditNotes.$inferSelect;

export interface CreateCreditNoteInput {
  organizationId: string;
  invoiceId: string;
  reason: string;
  amount: number;
  issuedByUserId?: string | undefined;
}

export async function insertCreditNote(
  tx: DatabaseClient,
  input: CreateCreditNoteInput,
): Promise<CreditNote> {
  const [creditNote] = await tx
    .insert(schema.creditNotes)
    .values({
      organizationId: input.organizationId,
      invoiceId: input.invoiceId,
      reason: input.reason,
      amount: String(input.amount),
      issuedByUserId: input.issuedByUserId ?? null,
    })
    .returning();
  if (!creditNote) throw new Error('Failed to insert credit note');
  return creditNote;
}

export async function listCreditNotesForInvoice(
  tx: DatabaseClient,
  invoiceId: string,
): Promise<CreditNote[]> {
  return tx
    .select()
    .from(schema.creditNotes)
    .where(eq(schema.creditNotes.invoiceId, invoiceId))
    .orderBy(desc(schema.creditNotes.issuedAt));
}
