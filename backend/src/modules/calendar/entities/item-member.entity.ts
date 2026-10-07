import { Entity, PrimaryColumn, Column } from 'typeorm';

/** Members an item is about; composite FKs keep both sides in the item's Space. */
@Entity({ name: 'item_members' })
export class ItemMemberEntity {
  @Column({ name: 'space_id', type: 'char', length: 36 }) spaceId: string;
  @PrimaryColumn({ name: 'item_id', type: 'char', length: 36 }) itemId: string;
  @PrimaryColumn({ name: 'member_id', type: 'char', length: 36 }) memberId: string;
}
