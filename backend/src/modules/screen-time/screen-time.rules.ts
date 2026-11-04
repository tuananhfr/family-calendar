import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import { addDays, daysBetween, isLocalDate } from '../../common/time/local-date';
import { todayIn, zonedToInstant } from '../../common/time/zoned';
import type { SpaceAccessContext } from '../access/evaluate-access';
import type { ScreenBatchDto, ScreenSummaryQueryDto } from './screen-time.dto';

export function screenMemberAccess(ctx: SpaceAccessContext, memberId: string): { view: boolean; manage: boolean } {
  if (ctx.spaceKind !== 'FAMILY') return { view: false, manage: false };
  const manage = ctx.roleKey === 'OWNER' || ctx.guardianOfMemberIds.includes(memberId);
  return { view: manage || ctx.representedMemberIds.includes(memberId), manage };
}

export function validateScreenRange(range: ScreenSummaryQueryDto): void {
  if (
    !isLocalDate(range.from) ||
    !isLocalDate(range.to) ||
    range.to < range.from ||
    daysBetween(range.from, range.to) > 30
  ) {
    throw new ApiError(ErrorCode.VALIDATION_FAILED, 422, 'Chọn khoảng ngày hợp lệ, tối đa 31 ngày.');
  }
}

export function validateScreenBatch(batch: ScreenBatchDto, timeZone: string, now: Date, consentAt: Date): void {
  if (batch.time_zone !== timeZone) {
    throw new ApiError(ErrorCode.VALIDATION_FAILED, 422, 'Múi giờ đã thay đổi. Hãy đồng bộ cấu hình rồi thu thập lại.');
  }
  const today = todayIn(timeZone, now);
  const dates = new Set<string>();
  for (const day of batch.days) {
    if (
      !isLocalDate(day.local_date) ||
      day.local_date > today ||
      day.local_date < addDays(today, -90) ||
      dates.has(day.local_date)
    ) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, 422, 'Ngày thống kê không hợp lệ hoặc bị trùng.');
    }
    dates.add(day.local_date);
    const start = zonedToInstant(`${day.local_date}T00:00`, timeZone).getTime();
    const end = zonedToInstant(`${addDays(day.local_date, 1)}T00:00`, timeZone).getTime();
    const captured = Date.parse(day.captured_at);
    const observed = Date.parse(day.observed_from);
    const duration = Math.floor((captured - observed) / 1000);
    const packages = new Set(day.apps.map((app) => app.package_name));
    if (
      !Number.isFinite(captured) ||
      !Number.isFinite(observed) ||
      observed < start ||
      observed < consentAt.getTime() ||
      captured > end ||
      captured > now.getTime() + 60_000 ||
      captured < observed ||
      day.total_seconds > duration ||
      packages.size !== day.apps.length ||
      day.apps.some((app) => app.seconds > duration) ||
      day.total_seconds > day.apps.reduce((sum, app) => sum + app.seconds, 0) ||
      (day.coverage === 'COMPLETE' && observed !== start)
    ) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, 422, 'Thời gian thu thập hoặc thời lượng không hợp lệ.');
    }
  }
}
