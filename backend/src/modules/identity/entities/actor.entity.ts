import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'actors' })
export class ActorEntity {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt: Date;
}
