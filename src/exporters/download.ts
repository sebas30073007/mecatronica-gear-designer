export function downloadTextFile(content: string, filename: string, mimeType = 'text/plain'): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

export const downloadSvg = (content: string, filename: string) =>
  downloadTextFile(content, filename, 'image/svg+xml');

export const downloadDxf = (content: string, filename: string) =>
  downloadTextFile(content, filename, 'application/dxf');

export const downloadStl = (content: string, filename: string) =>
  downloadTextFile(content, filename, 'model/stl');

export const downloadObj = (content: string, filename: string) =>
  downloadTextFile(content, filename, 'model/obj');
