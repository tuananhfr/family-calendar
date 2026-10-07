import type { DataSource } from 'typeorm';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { SessionContext } from '../../common/http/current-session.decorator';
import { isClientId } from '../../common/ids';
import type { AccessService } from './access.service';
import { hasLevel, type SpaceAccessContext } from './evaluate-access';
import type { Capability, Level } from './role-matrix';

/**
 * Access for features that only exist on a Space the server holds (AI, ICS feeds, integrations). Unknown,
 * LOCAL_ONLY/not-yet-shared and foreign Spaces all answer 404, so these routes never confirm that an id exists;
 * a member without the capability gets 403.
 */
export async function sharedSpaceContext(
  ds: DataSource,
  access: AccessService,
  session: SessionContext,
  spaceId: string,
  cap: Capability,
  level: Level,
): Promise<SpaceAccessContext> {
  const notFound = () => new ApiError(ErrorCode.NOT_FOUND, 404);
  if (!isClientId(spaceId)) throw notFound();
  const [space]: Array<{ sharing_state: string }> = await ds.query('SELECT sharing_state FROM spaces WHERE id = ?', [
    spaceId,
  ]);
  if (space?.sharing_state !== 'SHARED') throw notFound();
  let ctx: SpaceAccessContext;
  try {
    ctx = await access.loadContext(session, spaceId);
  } catch (err) {
    if (err instanceof ApiError && err.code === ErrorCode.FORBIDDEN) throw notFound();
    throw err;
  }
  if (!hasLevel(ctx, cap, level)) throw new ApiError(ErrorCode.FORBIDDEN, 403);
  return ctx;
}
