import { SharedMedia1791301300000 } from "./1791301300000-shared-media";
import type { MixedList } from 'typeorm';
import { CoreIdentity1791300000000 } from './1791300000000-core-identity';
import { RateLimits1791300100000 } from './1791300100000-rate-limits';
import { SpacesRolesMemberships1791300200000 } from './1791300200000-spaces-roles-memberships';
import { Resources1791300300000 } from './1791300300000-resources';
import { BootstrapChunks1791300400000 } from './1791300400000-bootstrap-chunks';
import { Invites1791300500000 } from './1791300500000-invites';
import { MagicLinkActor1791300600000 } from './1791300600000-magic-link-actor';
import { FileBlobs1791300700000 } from './1791300700000-file-blobs';
import { NotificationJobs1791300800000 } from './1791300800000-notification-jobs';
import { NotificationsPush1791300900000 } from './1791300900000-notifications-push';
import { Emergency1791301000000 } from './1791301000000-emergency';
import { Ai1791301100000 } from './1791301100000-ai';
import { IcsIntegrations1791301200000 } from './1791301200000-ics-integrations';

/** Every migration class, oldest first. New migrations must be appended here. */
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export const ALL_MIGRATIONS: MixedList<Function> = [
  CoreIdentity1791300000000,
  RateLimits1791300100000,
  SpacesRolesMemberships1791300200000,
  Resources1791300300000,
  BootstrapChunks1791300400000,
  Invites1791300500000,
  MagicLinkActor1791300600000,
  FileBlobs1791300700000,
  NotificationJobs1791300800000,
  NotificationsPush1791300900000,
  Emergency1791301000000,
  Ai1791301100000,
  IcsIntegrations1791301200000,
  SharedMedia1791301300000,
];
