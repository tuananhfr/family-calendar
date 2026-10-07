import { Column, Entity, PrimaryColumn } from 'typeorm';

/** SELF: the Actor is this Member. GUARDIAN: the Actor may view this Member's health records (§2.2 ²). */
export type RepresentationRelation = 'SELF' | 'GUARDIAN';

@Entity({ name: 'member_representations' })
export class MemberRepresentationEntity {
  @PrimaryColumn({ name: 'space_id', type: 'char', length: 36 }) spaceId: string;
  @PrimaryColumn({ name: 'actor_id', type: 'char', length: 36 }) actorId: string;
  @PrimaryColumn({ name: 'member_id', type: 'char', length: 36 }) memberId: string;
  @Column({ type: 'enum', enum: ['SELF', 'GUARDIAN'] }) relation: RepresentationRelation;
  @Column({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt: Date;
}
