"use client";

import {
  BarChart3,
  Clock3,
  Leaf,
  Radio,
  Smartphone,
  Target,
} from "lucide-react";
import { Avatar, Card, ProgressBar } from "@/design/components";
import { MemberAvatar, useMember } from "@/features/members";
import {
  durationLabel,
  screenStats,
  type AppUsage,
  type ScreenMember,
  type ScreenSummary,
  type UsageDay,
} from "./model";

const COLORS = [
  "var(--color-primary)",
  "var(--color-warning)",
  "var(--color-success)",
  "#8b5cf6",
  "var(--color-muted)",
];

export function ScreenMemberAvatar({
  member,
  large = false,
}: {
  member: ScreenMember;
  large?: boolean;
}) {
  const local = useMember(member.id);
  return local ? (
    <MemberAvatar
      name={member.display_name}
      avatar={local.avatar}
      relationship={local.relationship}
      size={large ? "lg" : "md"}
    />
  ) : (
    <Avatar name={member.display_name} size={large ? "lg" : "md"} />
  );
}

export function ScreenOverview({
  member,
  data,
  day,
  today,
}: {
  member: ScreenMember;
  data: ScreenSummary;
  day: UsageDay | undefined;
  today: string;
}) {
  const stats = screenStats(data.days);
  const seconds = day?.total_seconds ?? null;
  const goal = data.goal?.limit_minutes;
  const latest = data.days
    .map((d) => d.updated_at)
    .filter((v): v is string => !!v)
    .sort()
    .at(-1);
  const update = latest
    ? new Intl.DateTimeFormat("vi-VN", {
        timeZone: data.time_zone,
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
      }).format(new Date(latest))
    : "Chưa nhận số liệu";
  const active = data.devices.some((d) => d.state === "ACTIVE");
  const complete = day?.coverage === "COMPLETE" && active;
  const remaining =
    goal && seconds !== null ? Math.max(0, goal * 60 - seconds) : null;
  const dayLabel = day?.date === today ? "hôm nay" : "ngày đang xem";
  const advice =
    seconds === null
      ? "Mở ứng dụng Android đã liên kết để tự gửi số liệu. Trang này cập nhật khi nhận được dữ liệu mới."
      : !complete
        ? "Đây là số liệu đã ghi nhận trong một phần ngày. Hãy cùng theo dõi thêm trước khi đánh giá mục tiêu."
        : remaining !== null
          ? remaining > 0
            ? `Còn ${durationLabel(remaining)} đến mục tiêu ${dayLabel}. Cùng dành thời gian nghỉ mắt và vận động nhé.`
            : `Đã đạt mốc mục tiêu ${dayLabel}. Cùng cân nhắc dành thời gian cho các hoạt động khác nhé.`
          : "Đặt một mục tiêu vừa sức để cùng xây dựng thói quen sử dụng điện thoại cân bằng.";

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <Card className="flex flex-col gap-5 bg-gradient-to-br from-primary-soft/60 to-surface">
        <div className="flex min-w-0 items-center gap-3">
          <ScreenMemberAvatar member={member} large />
          <div className="min-w-0 flex-1">
            <h2 className="break-words text-lg font-bold text-text">
              {member.display_name}
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              {member.profile === "CHILD" ? "Hồ sơ con" : "Thành viên gia đình"}{" "}
              · Điện thoại Android
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted">
              <Clock3 aria-hidden className="size-3 shrink-0" /> Số liệu cập
              nhật: {update}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm text-body">
            {day?.date === today
              ? "Đã sử dụng hôm nay"
              : `Thời gian ngày ${day?.date ?? today}`}
          </p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <strong className="text-3xl font-extrabold tracking-tight text-text">
              {durationLabel(seconds)}
            </strong>
            {goal && (
              <span className="text-sm text-muted">
                / {durationLabel(goal * 60)}
              </span>
            )}
          </div>
          {data.days.length > 1 && (
            <p className="mt-3 text-xs text-muted">
              Tổng đã ghi nhận trong {data.days.length} ngày:{" "}
              <strong className="text-text">
                {durationLabel(stats.total)}
              </strong>
            </p>
          )}
          {goal && seconds !== null ? (
            <ProgressBar
              className="mt-4"
              value={(seconds / (goal * 60)) * 100}
              label="Thời gian so với mục tiêu ngày đang xem"
              colorVar={
                seconds >= goal * 60 ? "--color-warning" : "--color-success"
              }
            />
          ) : (
            <p className="mt-3 text-xs text-muted">
              {goal
                ? "Chưa có số liệu để so với mục tiêu."
                : "Chưa đặt mục tiêu mỗi ngày."}
            </p>
          )}
          <div className="mt-4 grid grid-cols-3 divide-x divide-border border-t border-border pt-4 text-center">
            <div className="min-w-0 px-1">
              <BarChart3
                aria-hidden
                className="mx-auto mb-1 size-5 text-primary"
              />
              <strong className="block text-sm text-text">
                {stats.observedDays}/{data.days.length}
              </strong>
              <span className="text-[11px] text-muted">Ngày có dữ liệu</span>
            </div>
            <div className="min-w-0 px-1">
              <Smartphone
                aria-hidden
                className="mx-auto mb-1 size-5 text-primary"
              />
              <strong className="block text-sm text-text">
                {day?.total_seconds === null || !day ? "—" : day.apps.length}
              </strong>
              <span className="text-[11px] text-muted">Ứng dụng</span>
            </div>
            <div className="min-w-0 px-1">
              <Target
                aria-hidden
                className="mx-auto mb-1 size-5 text-primary"
              />
              <strong className="block text-sm text-text">
                {durationLabel(stats.average)}
              </strong>
              <span className="text-[11px] text-muted">TB ngày có dữ liệu</span>
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl bg-success-soft p-3.5">
          <Leaf aria-hidden className="mt-0.5 size-5 shrink-0 text-success" />
          <div>
            <h3 className="text-sm font-bold text-text">
              Cùng xây dựng thói quen tốt
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-body">{advice}</p>
          </div>
        </div>
        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
          <Radio aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />{" "}
          Tự gửi khi mở app Android; chạy nền khoảng 15 phút hoặc lâu hơn.
          Website tự tải số liệu mỗi 15 giây khi đang mở.
        </p>
      </Card>
      <AppDistribution apps={day?.apps ?? []} known={seconds !== null} />
    </div>
  );
}

function AppDistribution({
  apps,
  known,
}: {
  apps: AppUsage[];
  known: boolean;
}) {
  const sorted = [...apps]
    .filter((a) => a.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds);
  const total = sorted.reduce((sum, a) => sum + a.seconds, 0);
  const groups = sorted
    .slice(0, 4)
    .map((app) => ({ name: app.label, seconds: app.seconds }));
  if (sorted.length > 4)
    groups.push({
      name: "Ứng dụng còn lại",
      seconds: sorted.slice(4).reduce((sum, a) => sum + a.seconds, 0),
    });
  let offset = 0;
  return (
    <Card className="flex flex-col gap-5">
      <div>
        <h2 className="font-bold text-text">Phân bổ ứng dụng</h2>
        <p className="mt-1 text-xs text-muted">
          Theo thời lượng các ứng dụng trong ngày đang xem
        </p>
      </div>
      <div className="relative mx-auto size-44 shrink-0 sm:size-48">
        <svg
          viewBox="0 0 120 120"
          className="size-full -rotate-90"
          role="img"
          aria-label={
            total
              ? `Phân bổ ${groups.length} nhóm ứng dụng; chi tiết ở danh sách bên dưới`
              : "Chưa có thời lượng ứng dụng để phân bổ"
          }
        >
          <circle
            cx="60"
            cy="60"
            r="48"
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="13"
          />
          {groups.map((group, i) => {
            const share = (group.seconds / total) * 100;
            const start = offset;
            offset += share;
            return (
              <circle
                key={group.name + i}
                cx="60"
                cy="60"
                r="48"
                fill="none"
                stroke={COLORS[i]}
                strokeWidth="13"
                pathLength="100"
                strokeDasharray={`${share} ${100 - share}`}
                strokeDashoffset={-start}
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          <span className="text-lg font-bold text-text">
            {known ? durationLabel(total) : "—"}
          </span>
          <span className="mt-1 text-[11px] text-muted">Tổng ứng dụng</span>
        </div>
      </div>
      {groups.length ? (
        <ul className="space-y-3">
          {groups.map((group, i) => (
            <li
              key={group.name + i}
              className="flex min-w-0 items-start gap-2 text-sm"
            >
              <span
                aria-hidden
                className="mt-1.5 size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: COLORS[i] }}
              />
              <span className="min-w-0 flex-1 break-words text-body">
                {group.name}
              </span>
              <span className="shrink-0 text-right font-semibold text-text">
                {durationLabel(group.seconds)}
                <span className="ml-1 text-xs font-normal text-muted">
                  ({Math.round((group.seconds / total) * 100)}%)
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-center text-sm text-muted">
          {known
            ? "Chưa ghi nhận thời lượng ứng dụng."
            : "Báo cáo sẽ xuất hiện sau lần thu thập đầu tiên."}
        </p>
      )}
      <p className="mt-auto border-t border-border pt-3 text-xs leading-relaxed text-muted">
        Tỷ lệ tính trên tổng thời lượng ứng dụng. Khi nhiều ứng dụng chạy chồng
        nhau, tổng này có thể lớn hơn thời gian sử dụng thiết bị.
      </p>
    </Card>
  );
}
