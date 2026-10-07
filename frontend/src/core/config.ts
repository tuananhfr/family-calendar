// The only module allowed to read build-time env, so configuration has one audit point.
export const appConfig = {
  apiBase: "/api/v1",
  appName: "Lịch Gia Đình",
  defaultTimeZone: "Asia/Ho_Chi_Minh",
  buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev",
} as const;
