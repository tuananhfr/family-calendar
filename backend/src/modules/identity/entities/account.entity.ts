import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'accounts' })
export class AccountEntity {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ type: 'varchar', length: 254 }) email: string;
  @Column({ name: 'email_verified_at', type: 'datetime', precision: 3, nullable: true }) emailVerifiedAt: Date | null;
  @Column({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt: Date;
}
