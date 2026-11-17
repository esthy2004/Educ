import * as XLSX from 'xlsx';
import { downloadBlob } from '@/utils/format';

export type ExportRow = Record<string, string | number | null | undefined>;

export function exportToExcel(rows: ExportRow[], filename: string, sheetName = 'Données'): void {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const widths = Object.keys(rows[0] ?? {}).map((key) => ({
    wch: Math.min(
      42,
      Math.max(
        key.length + 2,
        ...rows.slice(0, 200).map((row) => String(row[key] ?? '').length + 2),
      ),
    ),
  }));
  worksheet['!cols'] = widths;
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export function exportToCsv(rows: ExportRow[], filename: string): void {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const content = [
    headers.map(escape).join(';'),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(';')),
  ].join('\r\n');
  downloadBlob(new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' }), filename);
}

export async function readExcelFile(file: File): Promise<Record<string, string>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  return rows.map((row) => {
    const normalized: Record<string, string> = {};
    Object.entries(row).forEach(([key, value]) => {
      normalized[key.trim().toLowerCase()] = String(value ?? '').trim();
    });
    return normalized;
  });
}
