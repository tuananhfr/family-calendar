/** "1,5 MB" style sizes for the storage line; Vietnamese decimal comma. */
export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const rounded = unit === 0 ? String(Math.round(value)) : value.toFixed(value < 10 ? 1 : 0).replace(".", ",");
  return `${rounded.replace(/,0$/, "")} ${units[unit]}`;
}
