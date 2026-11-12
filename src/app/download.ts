/** Offer a file to the user as a download. */
export function downloadBlob(blob: Blob, filename: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

/** File-name-safe version of a user-given name. */
export function safeFilename(name: string): string {
  return (
    name
      .trim()
      .replace(/[^\w-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'motif'
  );
}
