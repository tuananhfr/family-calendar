import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CLOCK, type Clock } from '../jobs/clock';

@Injectable()
export class EmergencyLocationRetention {
  private lastRunAt = Number.NEGATIVE_INFINITY;

  constructor(private readonly ds: DataSource, @Inject(CLOCK) private readonly clock: Clock) {}

  async purge(): Promise<void> {
    const now = this.clock.now();
    await this.ds.query(
      `DELETE location FROM emergency_locations location
        INNER JOIN emergency_events event ON event.id = location.event_id
        WHERE event.lifecycle <> 'ACTIVE' AND event.updated_at <= ?`,
      [new Date(now.getTime() - 24 * 3600_000)],
    );
  }

  async tick(): Promise<number> {
    const now = this.clock.now().getTime();
    if (now - this.lastRunAt >= 60_000 || now < this.lastRunAt) {
      await this.purge();
      this.lastRunAt = now;
    }
    return 0;
  }
}
