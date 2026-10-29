export function normalizedPhone(value: string): string | null {
  const trimmed = value.trim();
  if (!/^\+?[\d ()-]{3,30}$/.test(trimmed)) return null;
  const phone = trimmed.replace(/[ ()-]/g, "");
  return /^\+?\d{3,15}$/.test(phone) ? phone : null;
}

export function dialerUrl(value: string): string | null {
  const phone = normalizedPhone(value);
  return phone ? `tel:${phone}` : null;
}
