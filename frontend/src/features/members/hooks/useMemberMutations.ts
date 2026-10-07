"use client";

import { db } from "@/core/db/db";
import { getLocalIdentity } from "@/core/db/local-identity";
import { newId } from "@/core/ids";
import type { Member } from "@/core/model/member";
import { saveResource } from "@/core/repo/write";
import { avatarValue, parseAvatar } from "../model/avatar";
import { draftToMember, type MemberDraft } from "../model/member-draft";

export interface SaveMemberInput {
  spaceId: string;
  draft: MemberDraft;
  existing?: Member;
  /** Already resized photo; replaces any previous uploaded photo. */
  photo?: Blob;
}

async function saveMember({ spaceId, draft, existing, photo }: SaveMemberInput): Promise<Member> {
  const { actorId } = await getLocalIdentity();
  // Blob and member land together: a quota error must not leave an orphan photo or a member pointing at nothing.
  return db.transaction("rw", [db.blobs, db.members, db.spaces, db.outbox], async () => {
    let avatar = draft.avatar;
    const previous = parseAvatar(existing?.avatar);
    if (photo) {
      const id = newId();
      await db.blobs.add({
        id,
        kind: "FILE",
        mime: photo.type,
        size: photo.size,
        data: photo,
        createdAt: new Date().toISOString(),
      });
      avatar = avatarValue({ kind: "blob", id });
    }
    const member = draftToMember({ ...draft, avatar }, { spaceId, actorId, existing });
    const saved = await saveResource("member", member, existing ? "update" : "create");
    const current = parseAvatar(saved.avatar);
    if (previous?.kind === "blob" && !(current?.kind === "blob" && current.id === previous.id)) await db.blobs.delete(previous.id);
    return saved;
  });
}

async function setStatus(member: Member, status: Member["status"]): Promise<void> {
  await saveResource("member", { ...member, status }, "update");
}

const MUTATIONS = {
  save: saveMember,
  archive: (m: Member) => setStatus(m, "ARCHIVED"),
  restore: (m: Member) => setStatus(m, "ACTIVE"),
};

export function useMemberMutations() {
  return MUTATIONS;
}
