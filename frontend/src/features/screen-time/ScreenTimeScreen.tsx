"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Download,
  Link2,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Target,
  Trash2,
  Minus,
  Plus,
  Play,
  Globe,
  MessageCircle,
  AppWindow,
} from "lucide-react";
import { api, ApiRequestError } from "@/core/api/client";
import { appConfig } from "@/core/config";
import { saveBlob } from "@/core/platform/download";
import { isLocalDate } from "@/core/time/local-date";
import { ROUTES } from "@/app-shell/nav-config";
import {
  Button,
  Card,
  PageHeader,
  ProgressBar,
  SkeletonList,
  Tabs,
  TextField,
} from "@/design/components";
import { useActiveSpace, useSpaceToday } from "@/features/members";
import { useOnlineIdentity } from "@/features/identity/hooks/useOnlineIdentity";
import {
  DEVICE_STATES,
  durationLabel,
  screenRange,
  screenStats,
  type ScreenMember,
  type ScreenSummary,
  type UsageDay,
} from "./model";
import { ScreenMemberAvatar, ScreenOverview } from "./ScreenOverview";
import { AndroidAppDownload } from "./AndroidAppDownload";

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401)
      return "Phiên đăng nhập đã hết hạn. Hãy mở Cài đặt để đăng nhập lại.";
    if (error.status === 403) return "Bạn không còn quyền xem dữ liệu này.";
    if (error.status === 409)
      return "Mục tiêu đã được thay đổi ở nơi khác. Hãy tải lại trước khi lưu.";
    if (error.code === "NETWORK")
      return "Không thể kết nối máy chủ. Kiểm tra mạng rồi thử lại.";
    return error.message;
  }
  return "Chưa thực hiện được. Vui lòng thử lại.";
}

function stamp(value: string | null, timeZone: string): string {
  return value
    ? new Intl.DateTimeFormat("vi-VN", {
        timeZone,
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "Chưa cập nhật";
}

export function ScreenTimeScreen() {
  const { space, loading } = useActiveSpace();
  const identity = useOnlineIdentity();
  const ready =
    space?.kind === "FAMILY" && space.sharingState === "SHARED" && !!identity;
  const members = useQuery({
    queryKey: ["screen-members", space?.id, identity?.actorId],
    queryFn: ({ signal }) =>
      api<{ members: ScreenMember[] }>(
        "GET",
        `/spaces/${space!.id}/screen-time/members`,
        undefined,
        { signal },
      ),
    enabled: ready,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 60_000,
  });
  const [selection, setSelection] = useState("");
  const member =
    members.data?.members.find((m) => m.id === selection) ??
    members.data?.members.find((m) => m.profile === "CHILD") ??
    members.data?.members[0];
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Thời gian màn hình"
        subtitle="Cùng con xây dựng thói quen sử dụng điện thoại cân bằng."
        icon={<Smartphone />}
      />
      <AndroidAppDownload />
      {loading ? (
        <SkeletonList rows={3} />
      ) : !ready ? (
        <Card className="flex flex-col items-start gap-3">
          <span className="rounded-full bg-primary-soft p-3 text-primary">
            <Smartphone aria-hidden />
          </span>
          <h2 className="text-lg font-bold text-text">
            Kết nối điện thoại với gia đình
          </h2>
          <p className="text-sm text-body">
            Bật “Gia đình cùng sử dụng” trong Cài đặt trước khi liên kết điện
            thoại Android. Dữ liệu chỉ hiển thị cho chủ gia đình, người giám hộ
            được gắn với thành viên và chính thành viên đó.
          </p>
          <Link
            className="font-semibold text-primary underline"
            href={ROUTES.settings}
          >
            Mở Cài đặt
          </Link>
        </Card>
      ) : members.isError ? (
        <Failure error={members.error} retry={() => void members.refetch()} />
      ) : !members.data ? (
        <SkeletonList rows={3} />
      ) : !member ? (
        <Card>
          <h2 className="font-bold text-text">
            Chưa có thành viên được cấp quyền
          </h2>
          <p className="mt-2 text-sm text-body">
            Nhờ chủ gia đình liên kết hồ sơ của bạn hoặc thiết lập quan hệ người
            giám hộ.
          </p>
        </Card>
      ) : (
        <>
          <div
            aria-label="Chọn thành viên"
            className="flex gap-2 overflow-x-auto rounded-2xl border border-border bg-surface p-2 pb-3"
          >
            {members.data.members.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-label={`Xem thời gian màn hình của ${m.display_name}`}
                aria-pressed={m.id === member.id}
                onClick={() => setSelection(m.id)}
                className={`flex min-w-20 max-w-32 shrink-0 flex-col items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary ${m.id === member.id ? "bg-primary-soft font-bold text-primary ring-1 ring-inset ring-primary/30" : "text-body hover:bg-primary-soft"}`}
              >
                <ScreenMemberAvatar member={m} />
                <span className="max-w-full truncate">{m.display_name}</span>
              </button>
            ))}
          </div>
          <MemberReport
            key={`${space!.id}:${identity!.actorId}:${member.id}`}
            spaceId={space!.id}
            actorId={identity!.actorId}
            member={member}
          />
        </>
      )}
    </div>
  );
}

function Failure({ error, retry }: { error: unknown; retry(): void }) {
  return (
    <Card role="alert" className="flex flex-col items-start gap-3">
      <p className="text-sm text-danger">{errorMessage(error)}</p>
      <Button variant="secondary" onClick={retry}>
        Thử lại
      </Button>
    </Card>
  );
}

function MemberReport({
  spaceId,
  actorId,
  member,
}: {
  spaceId: string;
  actorId: string;
  member: ScreenMember;
}) {
  const today = useSpaceToday();
  const [period, setPeriod] = useState(1);
  const [anchor, setAnchor] = useState<string>();
  const end = anchor ?? today;
  const range = screenRange(end, period);
  const [selectedDate, setSelectedDate] = useState<string>();
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const root = `/spaces/${spaceId}/screen-time/members/${member.id}`;
  const queryKey = [
    "screen-summary",
    spaceId,
    actorId,
    member.id,
    range.from,
    range.to,
  ];
  const report = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      api<ScreenSummary>(
        "GET",
        `${root}/summary?from=${range.from}&to=${range.to}`,
        undefined,
        { signal },
      ),
    retry: false,
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 15_000,
  });
  const data = report.data;
  const selected =
    data?.days.find((d) => d.date === selectedDate) ??
    data?.days.find((d) => d.date === end);
  const stats = screenStats(data?.days ?? []);
  const stale = data?.devices.some((d) =>
    ["STALE", "PERMISSION_REVOKED", "PENDING_PERMISSION"].includes(d.state),
  );
  const refreshed = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["screen-summary", spaceId, actorId, member.id],
    });
  };
  const act = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setFeedback("");
    try {
      await fn();
      await refreshed();
      setFeedback(success);
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const exportData = () =>
    act(async () => {
      const value = await api<ScreenSummary>(
        "GET",
        `${root}/export?from=${range.from}&to=${range.to}`,
      );
      saveBlob(
        new Blob([JSON.stringify(value, null, 2)], {
          type: "application/json",
        }),
        `thoi-gian-man-hinh-${range.from}-${range.to}.json`,
      );
    }, "Đã xuất dữ liệu trong khoảng ngày đang xem.");

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Tabs
          label="Khoảng thống kê"
          className="w-full min-w-0 flex-none rounded-xl bg-primary-soft/60 p-1 sm:w-auto sm:max-w-md sm:flex-1 [&_[role=tablist]]:gap-1 [&_[role=tablist]]:pb-0 [&_[role=tab]]:flex-1 [&_[role=tab]]:justify-center"
          value={String(period)}
          onValueChange={(v) => {
            setPeriod(Number(v));
            setSelectedDate(undefined);
          }}
          items={[
            { value: "1", label: end === today ? "Hôm nay" : "Một ngày" },
            { value: "7", label: "7 ngày" },
            { value: "30", label: "30 ngày" },
          ]}
        />
        <div className="flex flex-wrap items-end gap-2">
          <TextField
            type="date"
            label="Đến ngày"
            max={today}
            value={end}
            onChange={(e) => {
              if (isLocalDate(e.target.value) && e.target.value <= today) {
                setAnchor(e.target.value);
                setSelectedDate(undefined);
              }
            }}
          />
          <Button
            variant="secondary"
            aria-label="Tải lại thống kê"
            icon={<RefreshCw className="size-4" />}
            loading={report.isFetching}
            onClick={() => void report.refetch()}
          />
        </div>
      </div>
      {report.isError ? (
        <Failure error={report.error} retry={() => void report.refetch()} />
      ) : !data ? (
        <SkeletonList rows={4} />
      ) : (
        <>
          <p className="text-sm text-muted">
            {range.from} – {range.to} · Múi giờ {data.time_zone} · Android
          </p>
          {(stale || stats.partial) && (
            <Card className="border-warning/40 bg-warning-soft" role="status">
              <p className="text-sm text-body">
                {stale
                  ? "Một số thiết bị chưa cập nhật hoặc đã tắt quyền. "
                  : ""}
                {stats.partial ? "Có ngày chỉ thu thập được một phần. " : ""}Số
                liệu hiện có chưa đủ để kết luận về toàn bộ thời gian sử dụng.
              </p>
            </Card>
          )}
          <ScreenOverview
            member={member}
            data={data}
            day={selected}
            today={today}
          />
          {data.days.some((d) => d.total_seconds !== null) ? (
            <UsageChart
              days={data.days}
              goal={data.goal?.limit_minutes}
              selected={selected?.date}
              onSelect={setSelectedDate}
            />
          ) : (
            <Card className="flex flex-col gap-2">
              <h2 className="font-bold text-text">
                Chưa có dữ liệu trong khoảng ngày này
              </h2>
              <p className="text-sm text-body">
                Liên kết điện thoại Android và cấp quyền truy cập dữ liệu sử
                dụng. Ứng dụng tự gửi khi được mở và theo lịch chạy nền. Dữ liệu
                bắt đầu từ lúc bạn đồng ý chia sẻ.
              </p>
            </Card>
          )}
          {selected && (
            <Card className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-bold text-text">
                    Chi tiết ứng dụng · {selected.date}
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    Cập nhật: {stamp(selected.updated_at, data.time_zone)}
                    {selected.coverage === "PARTIAL"
                      ? " · Dữ liệu một phần"
                      : ""}
                  </p>
                </div>
                <span className="text-lg font-bold text-primary">
                  {durationLabel(selected.total_seconds)}
                </span>
              </div>
              {selected.total_seconds !== null && data.goal && (
                <div className="flex flex-col gap-2">
                  <ProgressBar
                    value={
                      (selected.total_seconds /
                        (data.goal.limit_minutes * 60)) *
                      100
                    }
                    label="Thời gian so với mục tiêu"
                  />
                  <p className="text-xs text-muted">
                    {selected.coverage === "COMPLETE" && !stale
                      ? selected.total_seconds >= data.goal.limit_minutes * 60
                        ? "Đã đạt mốc mục tiêu. Cùng cân nhắc thời gian nghỉ thiết bị."
                        : `Còn ${durationLabel(Math.max(0, data.goal.limit_minutes * 60 - selected.total_seconds))} đến mốc mục tiêu.`
                      : "Chưa đủ dữ liệu cập nhật để kết luận về mục tiêu."}
                  </p>
                </div>
              )}
              {selected.total_seconds === null ? (
                <p className="text-sm text-muted">
                  Chưa nhận được dữ liệu ngày này.
                </p>
              ) : !selected.apps.length ? (
                <p className="text-sm text-muted">
                  Chưa ghi nhận thời gian ứng dụng trong cửa sổ quan sát.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {selected.apps.map((app) => (
                    <li
                      key={app.package_name}
                      className="flex min-w-0 items-center gap-3 py-3"
                    >
                      <span
                        aria-hidden
                        className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-primary-soft text-primary"
                      >
                        {app.package_name === "com.android.chrome" ? (
                          <Globe className="size-6" />
                        ) : /youtube|video/.test(app.package_name) ? (
                          <Play className="size-6" />
                        ) : /zalo|messag|chat/.test(app.package_name) ? (
                          <MessageCircle className="size-6" />
                        ) : (
                          <AppWindow className="size-6" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap justify-between gap-2">
                          <span className="break-words text-sm font-semibold text-text">
                            {app.label}
                          </span>
                          <span className="text-right text-sm font-semibold text-text">
                            {durationLabel(app.seconds)}
                            <span className="ml-2 text-xs font-normal text-muted">
                              {Math.round(
                                (app.seconds /
                                  Math.max(
                                    1,
                                    selected.apps.reduce(
                                      (sum, a) => sum + a.seconds,
                                      0,
                                    ),
                                  )) *
                                  100,
                              )}
                              %
                            </span>
                          </span>
                        </div>
                        <ProgressBar
                          className="mt-2"
                          value={
                            (app.seconds /
                              Math.max(
                                1,
                                selected.apps.reduce(
                                  (sum, a) => sum + a.seconds,
                                  0,
                                ),
                              )) *
                            100
                          }
                          label={`Tỷ lệ thời lượng ${app.label} trong tổng ứng dụng`}
                          showValue={false}
                          colorVar="--color-primary"
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted">
                Tổng thiết bị loại trừ thời gian ứng dụng chạy chồng nhau. Khi
                dùng nhiều thiết bị, số liệu cộng theo từng thiết bị; chưa loại
                trừ việc dùng đồng thời hai máy.
              </p>
            </Card>
          )}
          {data.can_manage && (
            <GoalEditor
              key={`${member.id}:${data.goal?.version ?? 0}`}
              goal={data.goal}
              busy={busy}
              onSave={(limit, reminders) =>
                act(
                  () =>
                    api("PUT", `${root}/goal`, {
                      limit_minutes: limit,
                      reminders_enabled: reminders,
                      version: data.goal?.version ?? 0,
                    }),
                  "Đã lưu mục tiêu.",
                )
              }
            />
          )}
          <Card className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Smartphone aria-hidden className="size-5 text-primary" />
              <h2 className="font-bold text-text">Điện thoại đã liên kết</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted">
              Không cần bấm đồng bộ mỗi lần: ứng dụng Android tự gửi khi mở lại,
              mỗi phút khi đang mở và theo lịch nền khoảng 15 phút. Tiết kiệm
              pin, mất mạng hoặc buộc dừng ứng dụng có thể làm số liệu cập nhật
              chậm.
            </p>
            {!data.devices.length && (
              <p className="text-sm text-muted">
                Chưa liên kết điện thoại nào.
              </p>
            )}
            <ul className="divide-y divide-border">
              {data.devices.map((device) => (
                <li
                  key={device.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-text">
                      {device.label}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {DEVICE_STATES[device.state] ?? device.state}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Lần cuối: {stamp(device.last_seen_at, data.time_zone)}
                    </p>
                  </div>
                  {device.state !== "DISCONNECTED" && (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Ngừng chia sẻ từ điện thoại này? Dữ liệu đã đồng bộ vẫn được giữ cho đến khi bạn xóa.",
                          )
                        )
                          void act(
                            () => api("DELETE", `${root}/devices/${device.id}`),
                            "Đã ngừng chia sẻ.",
                          );
                      }}
                    >
                      Ngừng chia sẻ
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {data.can_manage && <PairDevice root={root} onPaired={refreshed} />}
          </Card>
          <Card className="flex flex-col items-start gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck aria-hidden className="size-5 text-primary" />
              <h2 className="font-bold text-text">Dữ liệu của thành viên</h2>
            </div>
            <p className="text-sm text-muted">
              Chỉ thu thời lượng và tên ứng dụng. Không thu tin nhắn, nội dung
              trình duyệt, ảnh hay vị trí. Có thể ngừng chia sẻ ngay trên điện
              thoại.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                icon={<Download className="size-4" />}
                disabled={busy}
                onClick={() => void exportData()}
              >
                Xuất JSON
              </Button>
              <Button
                variant="danger"
                icon={<Trash2 className="size-4" />}
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Xóa toàn bộ thống kê, mục tiêu và liên kết điện thoại của thành viên này? Thao tác này không thể hoàn tác.",
                    )
                  )
                    void act(
                      () => api("DELETE", `${root}/data`, { confirm: true }),
                      "Đã xóa dữ liệu và thu hồi các liên kết điện thoại.",
                    );
                }}
              >
                Xóa dữ liệu
              </Button>
            </div>
          </Card>
        </>
      )}
      <p role="status" aria-live="polite" className="text-sm text-body">
        {feedback}
      </p>
    </>
  );
}

function GoalEditor({
  goal,
  busy,
  onSave,
}: {
  goal: ScreenSummary["goal"];
  busy: boolean;
  onSave(limit: number, reminders: boolean): Promise<void>;
}) {
  const [limit, setLimit] = useState(String(goal?.limit_minutes ?? 120));
  const [reminders, setReminders] = useState(goal?.reminders_enabled ?? true);
  const valid =
    Number.isInteger(Number(limit)) &&
    Number(limit) >= 1 &&
    Number(limit) <= 1440;
  return (
    <Card id="screen-time-goal">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) void onSave(Number(limit), reminders);
        }}
      >
        <div className="flex items-center gap-2">
          <Target aria-hidden className="size-5 text-primary" />
          <h2 className="font-bold text-text">Mục tiêu mỗi ngày</h2>
        </div>
        <div className="flex max-w-sm items-end gap-2">
          <Button
            variant="secondary"
            className="shrink-0 self-center"
            aria-label="Giảm mục tiêu 30 phút"
            disabled={busy || Number(limit) <= 1}
            onClick={() =>
              setLimit(String(Math.max(1, (Number(limit) || 120) - 30)))
            }
            icon={<Minus className="size-4" />}
          />
          <TextField
            fieldClassName="min-w-0 flex-1"
            type="number"
            label="Số phút mỗi ngày"
            min={1}
            max={1440}
            step={1}
            required
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            helper="Từ 1 đến 1.440 phút. Đây là mục tiêu nhắc nhở."
          />
          <Button
            variant="secondary"
            className="shrink-0 self-center"
            aria-label="Tăng mục tiêu 30 phút"
            disabled={busy || Number(limit) >= 1440}
            onClick={() =>
              setLimit(String(Math.min(1440, (Number(limit) || 120) + 30)))
            }
            icon={<Plus className="size-4" />}
          />
        </div>
        <label className="flex items-start gap-3 text-sm text-body">
          <input
            type="checkbox"
            className="mt-1 size-4"
            checked={reminders}
            onChange={(e) => setReminders(e.target.checked)}
          />
          <span>
            <Bell aria-hidden className="mr-1 inline size-4" />
            Thông báo trong ứng dụng ở mốc 80% và 100%. Chỉ nhắc khi dữ liệu đủ
            và mới; có thể trễ theo đồng bộ.
          </span>
        </label>
        <Button
          type="submit"
          className="self-start"
          loading={busy}
          disabled={!valid}
        >
          Lưu mục tiêu
        </Button>
      </form>
    </Card>
  );
}

function PairDevice({
  root,
  onPaired,
}: {
  root: string;
  onPaired(): Promise<void>;
}) {
  const [label, setLabel] = useState("Điện thoại Android");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pairing, setPairing] = useState<{
    code: string;
    expires_at: string;
  }>();
  const [copied, setCopied] = useState(false);
  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const next = await api<{ code: string; expires_at: string }>(
        "POST",
        `${root}/pairings`,
        { label: label.trim(), consent: true },
      );
      setPairing(next);
      setCopied(false);
      await onPaired();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <h3 className="font-semibold text-text">Liên kết điện thoại Android</h3>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-body">
        <li>
          Cài ứng dụng “Lịch Gia Đình · Thời gian màn hình” trên điện thoại của
          con.
        </li>
        <li>
          Nhập địa chỉ máy chủ và mã bên dưới, đọc nội dung chia sẻ và xác nhận.
        </li>
        <li>
          Cấp quyền “Truy cập dữ liệu sử dụng”, rồi quay lại app để tự đồng bộ.
        </li>
      </ol>
      <div className="max-w-sm">
        <TextField
          label="Tên điện thoại"
          maxLength={100}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>
      <label className="flex items-start gap-3 text-sm text-body">
        <input
          type="checkbox"
          className="mt-1 size-4"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>
          Tôi được phép liên kết thiết bị với thành viên này và đã trao đổi về
          việc chia sẻ thời gian sử dụng.
        </span>
      </label>
      <Button
        className="self-start"
        icon={<Link2 className="size-4" />}
        disabled={!consent || !label.trim()}
        loading={busy}
        onClick={() => void create()}
      >
        Tạo mã liên kết
      </Button>
      {pairing && (
        <div className="flex flex-col gap-2 rounded-control bg-primary-soft p-4">
          <p className="text-sm text-body">
            Mã dùng một lần, hết hạn lúc{" "}
            {new Date(pairing.expires_at).toLocaleTimeString("vi-VN")}:
          </p>
          <p className="break-all font-mono text-xl font-bold tracking-wider text-primary">
            {pairing.code}
          </p>
          <TextField
            label="Địa chỉ máy chủ nhập trên điện thoại"
            readOnly
            value={
              typeof window === "undefined"
                ? ""
                : `${window.location.origin}${appConfig.basePath}/api/v1`
            }
          />
          <Button
            variant="secondary"
            className="self-start"
            onClick={() => {
              void navigator.clipboard
                .writeText(pairing.code)
                .then(() => setCopied(true))
                .catch(() => setError("Hãy chọn và sao chép mã thủ công."));
            }}
          >
            {copied ? "Đã sao chép" : "Sao chép mã"}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <p className="text-xs text-muted">
        Bản đầu hỗ trợ Android. iPhone chưa thu thập tự động. Chỉ bắt đầu thu
        thập từ khi người dùng điện thoại đồng ý.
      </p>
    </div>
  );
}

function UsageChart({
  days,
  goal,
  selected,
  onSelect,
}: {
  days: UsageDay[];
  goal?: number;
  selected?: string;
  onSelect(date: string): void;
}) {
  const max = Math.max(
    3600,
    (goal ?? 0) * 60,
    ...days.map((d) => d.total_seconds ?? 0),
  );
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-bold text-text">Thời gian sử dụng theo ngày</h2>
      <p className="text-xs text-muted">
        Chọn một cột để xem ứng dụng của ngày đó. Dấu “—” là chưa có dữ liệu.
      </p>
      <div dir="rtl" className="overflow-x-auto pb-2">
        <div
          dir="ltr"
          className="grid h-56 items-end gap-2"
          style={{
            gridTemplateColumns: `repeat(${days.length}, minmax(40px, 1fr))`,
            minWidth: days.length * 48,
          }}
        >
          {days.map((day) => (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelect(day.date)}
              aria-pressed={selected === day.date}
              aria-label={`${day.date}: ${durationLabel(day.total_seconds)}${day.coverage === "PARTIAL" ? ", dữ liệu một phần" : ""}`}
              className={`flex h-full flex-col justify-end gap-2 rounded-control p-1 text-center focus-visible:outline-2 focus-visible:outline-primary ${selected === day.date ? "bg-primary-soft" : ""}`}
            >
              <span className="text-[11px] tabular-nums text-body">
                {day.total_seconds === null
                  ? "—"
                  : `${Math.floor(day.total_seconds / 60)}p`}
              </span>
              <span
                aria-hidden
                className={`mx-auto w-full max-w-12 rounded-t-lg ${day.coverage === "PARTIAL" ? "bg-warning" : goal && day.total_seconds !== null && day.total_seconds > goal * 60 ? "bg-danger" : "bg-success"}`}
                style={{
                  height:
                    day.total_seconds === null
                      ? 3
                      : Math.max(4, (day.total_seconds / max) * 155),
                  opacity: day.total_seconds === null ? 0.2 : 1,
                }}
              />
              <span className="text-[11px] text-muted">
                {day.date.slice(8)}/{day.date.slice(5, 7)}
              </span>
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted">
        {goal ? `Mục tiêu: ${durationLabel(goal * 60)}/ngày. ` : ""}Cột vàng: dữ
        liệu một phần.
      </p>
      <details className="text-sm text-body">
        <summary className="cursor-pointer font-semibold text-primary">
          Xem bảng số liệu
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left">
            <caption className="sr-only">
              Thời gian sử dụng điện thoại từng ngày
            </caption>
            <thead>
              <tr>
                <th className="p-2">Ngày</th>
                <th className="p-2">Thời gian</th>
                <th className="p-2">Dữ liệu</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date} className="border-t border-border">
                  <td className="p-2">{d.date}</td>
                  <td className="p-2">{durationLabel(d.total_seconds)}</td>
                  <td className="p-2">
                    {d.coverage === "UNKNOWN"
                      ? "Chưa có"
                      : d.coverage === "PARTIAL"
                        ? "Một phần"
                        : "Đủ cửa sổ quan sát"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  );
}
