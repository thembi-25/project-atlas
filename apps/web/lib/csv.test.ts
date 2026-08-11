import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';

describe('toCsv', () => {
  it('renders a header row and one row per data item', () => {
    const rows = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ];
    const csv = toCsv(rows, [
      { header: 'ID', value: (r) => r.id },
      { header: 'Name', value: (r) => r.name },
    ]);
    expect(csv).toBe('ID,Name\r\n1,Alice\r\n2,Bob\r\n');
  });

  it('renders only the header row for an empty result set', () => {
    const csv = toCsv<{ id: string }>([], [{ header: 'ID', value: (r) => r.id }]);
    expect(csv).toBe('ID\r\n');
  });

  it('quotes fields containing a comma, quote, or newline', () => {
    const rows = [{ note: 'Line one\nLine two, with a "quote"' }];
    const csv = toCsv(rows, [{ header: 'Note', value: (r) => r.note }]);
    expect(csv).toBe('Note\r\n"Line one\nLine two, with a ""quote"""\r\n');
  });
});
