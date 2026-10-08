export interface OnlineIdentity { actorId: string; deviceId: string; accountId: string | null; }
let identity: OnlineIdentity | null = null;
export function currentOnlineIdentity() { return identity; }
export function setOnlineIdentity(next: OnlineIdentity | null) { identity = next; }
