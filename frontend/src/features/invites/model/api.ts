import { api } from "@/core/api/client";
export interface Invite { invite_id: string; status: string; uses: number; max_uses: number; expires_at: string; email: string | null; }
export interface JoinRequest { request_id: string; display_name: string; proposed_profile: string | null; member_id: string | null; status: string; device_label: string | null; }
export interface Role { id: string; role_key: string; name: string; matrix: Record<string, string>; }
export interface Membership { actor_id: string; role_id: string; role_key: string; display_name: string; }
export interface MembershipList { memberships: Membership[]; roles: Role[]; can_manage: boolean; }
export const spaceEndpoint = (id: string) => "/spaces/" + encodeURIComponent(id);
export const getMemberships = (id: string) => api<MembershipList>("GET", spaceEndpoint(id) + "/memberships");
