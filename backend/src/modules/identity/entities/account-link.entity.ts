import { Column, Entity, PrimaryColumn } from 'typeorm';

/** An unlinked row keeps unlinked_at set; re-linking clears it instead of inserting a duplicate. */
@Entity({ name: 'account_links' })
export class AccountLinkEntity {
  @PrimaryColumn({ name: 'account_id', type: 'char', length: 36 }) accountId: string;
  @PrimaryColumn({ name: 'actor_id', type: 'char', length: 36 }) actorId: string;
  @Column({ name: 'linked_at', type: 'datetime', precision: 3 }) linkedAt: Date;
  @Column({ name: 'unlinked_at', type: 'datetime', precision: 3, nullable: true }) unlinkedAt: Date | null;
}
