export function csvContent(headers: string[], rows: (string | number)[][]): string {
  const cell = (value: string | number) => {
    const text = typeof value === 'string' && /^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  return '\uFEFF' + [headers, ...rows].map(row => row.map(cell).join(',')).join('\r\n');
}
export function exportCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const url = URL.createObjectURL(new Blob([csvContent(headers, rows)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
