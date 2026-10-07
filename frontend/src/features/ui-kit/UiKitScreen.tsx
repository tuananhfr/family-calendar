"use client";

import { useState, type ReactNode } from "react";
import { Bell, CalendarDays, CalendarPlus, Cake, FileText, ListChecks, Pill, Plus, Search, Wallet } from "lucide-react";
import { CATEGORIES } from "@/design/categories";
import {
  Avatar,
  AvatarStack,
  Badge,
  Button,
  Card,
  CategoryTag,
  Checkbox,
  Chip,
  ChipGroup,
  Countdown,
  DataTable,
  DateField,
  Dialog,
  EmptyState,
  ErrorState,
  EventCard,
  ForbiddenState,
  IconButton,
  LegendDot,
  PageHeader,
  PriorityTag,
  ProgressBar,
  ProgressRing,
  ScriptText,
  SectionCard,
  Select,
  Sheet,
  Skeleton,
  SkeletonList,
  StatCard,
  StatusTag,
  Switch,
  Tabs,
  TextArea,
  TextField,
  TimeField,
  Toaster,
  Tooltip,
  TooltipProvider,
  Truncate,
  toast,
} from "@/design/components";
import { THEME_STORAGE_KEY } from "@/design/theme-script";
import { LONG_TITLE, MEMBERS, TASK_ROWS, type TaskRow } from "./fixtures";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function setTheme(theme: "light" | "dark") {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage may be blocked (private mode); the attribute alone still switches the theme.
  }
}

export function UiKitScreen() {
  const [dialog, setDialog] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [sw, setSw] = useState(true);
  const [check, setCheck] = useState(true);
  const [chip, setChip] = useState("all");
  const [sel, setSel] = useState<string | undefined>();
  const [note, setNote] = useState("");

  const columns = [
    { key: "title", header: "Việc cần làm", className: "w-[30%]", render: (r: TaskRow) => <Truncate text={r.title} className="font-medium text-text" /> },
    { key: "cat", header: "Danh mục", className: "w-40", render: (r: TaskRow) => <CategoryTag category={r.category} /> },
    { key: "who", header: "Giao cho", render: (r: TaskRow) => <Truncate text={r.assignee} /> },
    { key: "due", header: "Thời hạn", render: (r: TaskRow) => r.due },
    { key: "prio", header: "Độ ưu tiên", render: (r: TaskRow) => <PriorityTag priority={r.priority} /> },
    { key: "status", header: "Trạng thái", render: (r: TaskRow) => <StatusTag status={r.status} /> },
  ];

  return (
    <TooltipProvider>
      <main className="mx-auto flex max-w-[1400px] flex-col gap-10 px-4 py-6 md:px-8">
        <PageHeader
          title="Bộ giao diện"
          subtitle="Mọi thành phần ở mọi trạng thái, dùng để kiểm tra trực quan."
          icon={<ListChecks />}
          illustration="corner-tasks"
          actions={
            <>
              <Button variant="secondary" size="sm" onClick={() => setTheme("light")}>
                Sáng
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setTheme("dark")}>
                Tối
              </Button>
            </>
          }
        />

        <Section title="Nút">
          <div className="flex flex-wrap items-center gap-3">
            <Button icon={<Plus aria-hidden className="size-4" />}>Thêm mới</Button>
            <Button variant="secondary">Bộ lọc</Button>
            <Button variant="soft">Chỉnh sửa</Button>
            <Button variant="ghost">Hủy</Button>
            <Button variant="danger">Xóa</Button>
            <Button loading>Đang lưu</Button>
            <Button disabled>Không khả dụng</Button>
            <Button size="lg">Lưu sự kiện</Button>
            <IconButton label="Tìm kiếm" icon={<Search className="size-5" />} />
            <IconButton label="Thông báo" icon={<Bell className="size-5" />} badge={3} />
            <Tooltip content="Mẹo: nhấn giữ để xem chi tiết">
              <Button variant="secondary" size="sm">
                Có gợi ý
              </Button>
            </Tooltip>
          </div>
        </Section>

        <Section title="Nhãn">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <CategoryTag key={c} category={c} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <PriorityTag priority="HIGH" />
            <PriorityTag priority="MEDIUM" />
            <PriorityTag priority="LOW" />
            <StatusTag status="TODO" />
            <StatusTag status="DONE" />
            <StatusTag status="OVERDUE" />
            <Badge tone="neutral">Trên thiết bị</Badge>
            <Badge tone="warning">Chờ đồng bộ (2)</Badge>
          </div>
          <div className="max-w-xs">
            <CategoryTag category="SPECIAL" label={LONG_TITLE} />
          </div>
        </Section>

        <Section title="Thống kê">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard icon={<ListChecks />} value={5} label="Việc cần làm hôm nay" tone="study" />
            <StatCard icon={<CalendarDays />} value={2} label="Lịch học / công việc" tone="housework" />
            <StatCard icon={<Cake />} value={1} label="Ngày đặc biệt" sublabel="Sinh nhật Bố" tone="health" />
            <StatCard icon={<Pill />} value={1} label="Nhắc uống thuốc" tone="special" />
            <StatCard icon={<FileText />} value={3} label="Đến hạn giấy tờ" tone="study" />
            <StatCard icon={<Wallet />} value={0} label={LONG_TITLE} tone="finance" />
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <ProgressRing value={85} label="Việc đã hoàn thành" />
            <ProgressRing value={100} label="Thành viên hoạt động" colorVar="--color-primary" />
            <div className="flex w-72 flex-col gap-2">
              <ProgressBar value={87} label="Uống vitamin" />
              <ProgressBar value={60} label="Tập thể dục" colorVar="--color-primary" />
            </div>
            <div className="flex w-64 flex-col gap-1.5">
              <LegendDot colorVar="--cat-study-dot" label="Học tập" value="28 (22%)" />
              <LegendDot colorVar="--cat-housework-dot" label="Việc nhà" value="24 (19%)" />
              <LegendDot colorVar="--cat-special-dot" label={LONG_TITLE} value="12 (9%)" />
            </div>
          </div>
        </Section>

        <Section title="Thẻ và danh sách">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SectionCard title="Ngày sắp tới" seeAllHref="/ngay-dac-biet">
              <ul className="flex flex-col gap-3">
                <li className="flex items-center gap-3">
                  <Cake aria-hidden className="size-5 shrink-0" style={{ color: "var(--cat-health-dot)" }} />
                  <div className="min-w-0 flex-1">
                    <Truncate text="Sinh nhật Bố" className="text-sm font-semibold text-text" />
                    <span className="text-xs text-muted">20/10/2026</span>
                  </div>
                  <Countdown days={14} />
                </li>
                <li className="flex items-center gap-3">
                  <Cake aria-hidden className="size-5 shrink-0" style={{ color: "var(--cat-health-dot)" }} />
                  <div className="min-w-0 flex-1">
                    <Truncate text={LONG_TITLE} className="text-sm font-semibold text-text" />
                    <span className="text-xs text-muted">08/10/2026</span>
                  </div>
                  <Countdown days={2} />
                </li>
              </ul>
            </SectionCard>
            <SectionCard title="Việc cần làm hôm nay" seeAllHref="/viec-can-lam">
              <Checkbox checked={check} onCheckedChange={setCheck} label="Mua sách cho bé An" strikeWhenChecked />
              <Checkbox checked={false} onCheckedChange={() => undefined} label={<Truncate text={LONG_TITLE} />} />
              <Checkbox checked={false} onCheckedChange={() => undefined} label="Không khả dụng" disabled />
            </SectionCard>
            <SectionCard title="Nhắc nhở sức khỏe">
              <Switch checked={sw} onCheckedChange={setSw} label="Uống vitamin" description="07:00 hằng ngày" />
              <Switch checked={false} onCheckedChange={() => undefined} label="Thuốc huyết áp" description="20:00 hằng ngày" disabled />
            </SectionCard>
          </div>
          <div className="grid max-w-3xl grid-cols-2 gap-3 md:grid-cols-4">
            <EventCard title="Tập thể dục" timeLabel="06:30 - 07:00" category="SPORT" />
            <EventCard title="Đưa bé đi học" timeLabel="07:00 - 07:30" category="HEALTH" />
            <EventCard title={LONG_TITLE} timeLabel="20:00 - 21:00" category="SPECIAL" />
            <EventCard title={LONG_TITLE} timeLabel="12:00 - 13:00" category="FAMILY" compact />
          </div>
        </Section>

        <Section title="Thành viên">
          <div className="flex flex-wrap items-center gap-4">
            {MEMBERS.map((m) => (
              <span key={m.name} className="flex flex-col items-center gap-1 text-sm">
                <Avatar name={m.name} preset={"preset" in m ? m.preset : undefined} colorVar={m.colorVar} size="lg" />
                {m.name}
              </span>
            ))}
            <Avatar name="Nguyễn Thị Hoa" size="lg" colorVar="--cat-finance-bg" />
            <AvatarStack people={[...MEMBERS]} />
          </div>
          <div className="flex flex-wrap gap-2">
            {MEMBERS.slice(0, 4).map((m) => (
              <Chip key={m.name} selected={m.name === "Bố"} icon={<Avatar name={m.name} preset={"preset" in m ? m.preset : undefined} size="xs" />}>
                {m.name}
              </Chip>
            ))}
            <Chip>{LONG_TITLE}</Chip>
          </div>
        </Section>

        <Section title="Bộ lọc và tab">
          <ChipGroup
            label="Lọc việc"
            value={chip}
            onChange={setChip}
            options={[
              { value: "all", label: "Tất cả" },
              { value: "mine", label: "Việc của tôi" },
              { value: "kids", label: "Việc của con" },
              { value: "home", label: "Việc nhà" },
              { value: "shop", label: "Mua sắm" },
              { value: "fin", label: "Tài chính" },
              { value: "study", label: "Học tập" },
              { value: "health", label: "Sức khỏe" },
            ]}
          />
          <Tabs
            label="Cài đặt"
            items={[
              { value: "general", label: "Chung", content: <p className="text-sm">Nội dung tab Chung</p> },
              { value: "notify", label: "Thông báo", content: <p className="text-sm">Nội dung tab Thông báo</p> },
              { value: "look", label: "Giao diện", content: <p className="text-sm">Nội dung tab Giao diện</p> },
              { value: "data", label: "Dữ liệu & Sao lưu", content: <p className="text-sm">Nội dung tab Dữ liệu</p> },
              { value: "sec", label: "Bảo mật", content: <p className="text-sm">Nội dung tab Bảo mật</p> },
            ]}
          />
        </Section>

        <Section title="Biểu mẫu">
          <Card className="grid max-w-3xl gap-4 md:grid-cols-2">
            <TextField label="Tiêu đề" required placeholder="Ví dụ: Uống vitamin, Đón bé đi học…" fieldClassName="md:col-span-2" />
            <TextField label="Email" optional type="email" placeholder="Nhập email…" error="Email chưa đúng định dạng" />
            <Select
              label="Lặp lại"
              value={sel}
              onValueChange={setSel}
              options={[
                { value: "none", label: "Không lặp lại" },
                { value: "daily", label: "Hằng ngày" },
                { value: "weekly", label: "Hằng tuần" },
                { value: "lunar", label: "Hằng năm (âm lịch)" },
              ]}
              helper="Có thể lặp theo âm lịch"
            />
            <DateField label="Ngày" required defaultValue="2026-10-06" />
            <TimeField label="Giờ" defaultValue="07:00" />
            <TextArea label="Mô tả" optional maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Thêm chi tiết để dễ nhớ hơn…" />
            <TextField label="Không khả dụng" disabled defaultValue="Chỉ xem" />
          </Card>
        </Section>

        <Section title="Bảng">
          <Card>
            <DataTable
              caption="Danh sách việc cần làm"
              columns={columns}
              rows={TASK_ROWS}
              rowKey={(r) => r.id}
              mobileCard={(r) => (
                <div className="flex flex-col gap-2">
                  <Truncate text={r.title} lines={2} className="font-semibold text-text" />
                  <div className="flex flex-wrap gap-2">
                    <CategoryTag category={r.category} />
                    <PriorityTag priority={r.priority} />
                    <StatusTag status={r.status} />
                  </div>
                  <span className="text-xs text-muted">
                    {r.assignee}, {r.due}
                  </span>
                </div>
              )}
            />
          </Card>
        </Section>

        <Section title="Trạng thái">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <SkeletonList rows={3} />
              <Skeleton className="mt-4 h-24 w-full" />
            </Card>
            <Card>
              <EmptyState title="Chưa có việc nào" body="Thêm việc đầu tiên để cả nhà cùng theo dõi." illustration="footer-tasks" action={<Button size="sm">Thêm việc</Button>} />
            </Card>
            <Card>
              <ErrorState onRetry={() => toast("Đang thử lại", "info")} />
            </Card>
            <Card>
              <ForbiddenState />
            </Card>
          </div>
        </Section>

        <Section title="Hộp thoại và thông báo">
          <div className="flex flex-wrap gap-3">
            <Button icon={<CalendarPlus aria-hidden className="size-4" />} onClick={() => setDialog(true)}>
              Mở hộp thoại
            </Button>
            <Button variant="secondary" onClick={() => setSheet(true)}>
              Mở bảng trượt
            </Button>
            <Button variant="soft" onClick={() => toast("Đã lưu nhắc nhở", "success")}>
              Thông báo thành công
            </Button>
            <Button variant="ghost" onClick={() => toast("Không lưu được. Hãy thử lại.", "error")}>
              Thông báo lỗi
            </Button>
          </div>
          <ScriptText>Nhà mình cùng xem cùng sắp xếp</ScriptText>
        </Section>

        <Dialog
          open={dialog}
          onOpenChange={setDialog}
          title="Thêm nhắc nhở"
          description="Đừng để điều quan trọng bị quên!"
          icon={<Bell />}
          illustration="corner-reminder-modal"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDialog(false)}>
                Hủy
              </Button>
              <Button icon={<Bell aria-hidden className="size-4" />} onClick={() => setDialog(false)}>
                Lưu nhắc nhở
              </Button>
            </>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="Tiêu đề" required fieldClassName="md:col-span-2" placeholder="Ví dụ: Uống vitamin…" />
            <DateField label="Ngày" required defaultValue="2026-10-06" />
            <TimeField label="Giờ" defaultValue="07:00" />
          </div>
        </Dialog>
        <Sheet open={sheet} onOpenChange={setSheet} title="Gia đình">
          <ul className="flex flex-col gap-1">
            {["Thành viên", "Nhóm & Chia sẻ", "Sức khỏe", "Tài chính gia đình", "Kho lưu trữ", "Cài đặt"].map((s) => (
              <li key={s} className="flex min-h-[var(--touch-min)] items-center rounded-control px-2 text-sm text-text hover:bg-primary-soft">
                {s}
              </li>
            ))}
          </ul>
        </Sheet>
        <Toaster />
      </main>
    </TooltipProvider>
  );
}
