function escapeCsvCell(value: string | number | null | undefined): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsvContent(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
): string {
  const headerLine = headers.map(escapeCsvCell).join(',');
  const dataLines = rows.map((row) => row.map(escapeCsvCell).join(','));
  return [headerLine, ...dataLines].join('\r\n');
}

export async function downloadTextFile(
  filename: string,
  content: string,
  mimeType: string
): Promise<'downloaded' | 'shared' | 'copied'> {
  // 1. Try native Web Share with File on supported Android browsers/WebViews
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const file = new File([content], filename, { type: mimeType });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
        });
        return 'shared';
      }
    } catch (err) {
      // User cancelled share or share unavailable — fall through to anchor download
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Share cancelled.');
      }
    }
  }

  // 2. Standard Blob anchor download
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return 'downloaded';
  } catch {
    // 3. Clipboard fallback
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(content);
      return 'copied';
    }
    throw new Error('Download blocked by browser. Use Copy Backup Text instead.');
  }
}
