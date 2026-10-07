import { Column, Entity } from 'typeorm';
import { ResourceEntity } from '../../../database/resource-entity';

export type Relationship =
  'FATHER' | 'MOTHER' | 'SON' | 'DAUGHTER' | 'GRANDFATHER' | 'GRANDMOTHER' | 'GUARDIAN' | 'OTHER';
export type MemberProfile = 'PARENT' | 'SENIOR' | 'CHILD';

/** Member (modules.md §3); phone, email and birth date are PRIVATE fields although the row is NORMAL. */
@Entity({ name: 'members' })
export class MemberEntity extends ResourceEntity {
  @Column({ name: 'display_name', type: 'varchar', length: 50 }) displayName: string;
  @Column({
    type: 'enum',
    enum: ['FATHER', 'MOTHER', 'SON', 'DAUGHTER', 'GRANDFATHER', 'GRANDMOTHER', 'GUARDIAN', 'OTHER'],
  })
  relationship: Relationship;
  @Column({ type: 'enum', enum: ['PARENT', 'SENIOR', 'CHILD'] }) profile: MemberProfile;
  @Column({ name: 'birth_date', type: 'date', nullable: true }) birthDate: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) phone: string | null;
  @Column({ type: 'varchar', length: 254, nullable: true }) email: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) avatar: string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) color: string | null;
  @Column({ type: 'json' }) interests: string[];
  @Column({ type: 'varchar', length: 500, nullable: true }) note: string | null;
  @Column({ type: 'enum', enum: ['ACTIVE', 'ARCHIVED'] }) status: 'ACTIVE' | 'ARCHIVED';
}
