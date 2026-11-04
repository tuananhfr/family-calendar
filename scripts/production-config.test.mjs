import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { validateProductionConfig } from "./check-production-config.mjs";

function example() {
  return {
    backend: {
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: "3005",
      API_ORIGIN: "https://calendar.test",
      FRONTEND_ORIGIN: "https://calendar.test",
      PUBLIC_BASE_PATH: "/family",
      COOKIE_SECURE: "true",
      DB_HOST: "127.0.0.1",
      DB_PORT: "3306",
      DB_USER: "calendar",
      DB_PASSWORD: "db-secret-for-test-only",
      DB_NAME: "calendar",
      STORAGE_MASTER_KEY: randomBytes(32).toString("hex"),
      STORAGE_DIR: "/var/lib/calendar/storage",
      RUN_WORKER_IN_PROCESS: "false",
      MAIL_TRANSPORT: "smtp",
      SMTP_URL: "smtps://user:secret@mail.calendar.test:465",
      MAIL_FROM: "Calendar <no-reply@calendar.test>",
    },
    frontend: {
      NEXT_PUBLIC_SITE_ORIGIN: "https://calendar.test",
      NEXT_PUBLIC_BASE_PATH: "/family",
    },
  };
}

test("accepts consistent public HTTPS deployment at a prefix and at the root", () => {
  const { backend, frontend } = example();
  assert.equal(
    validateProductionConfig(backend, frontend).url,
    "https://calendar.test/family",
  );
  backend.PUBLIC_BASE_PATH = "";
  frontend.NEXT_PUBLIC_BASE_PATH = "";
  assert.equal(
    validateProductionConfig(backend, frontend).url,
    "https://calendar.test",
  );
});

test("rejects local cookie/origin settings and mismatched API routes", () => {
  const { backend, frontend } = example();
  backend.COOKIE_SECURE = "false";
  backend.PUBLIC_BASE_PATH = "/wrong";
  backend.FRONTEND_ORIGIN += ",http://localhost:3004";
  assert.throws(
    () => validateProductionConfig(backend, frontend),
    (error) =>
      /COOKIE_SECURE/.test(error.message) &&
      /base paths/.test(error.message) &&
      /FRONTEND_ORIGIN/.test(error.message),
  );
});

test("rejects file mail transport, root DB user and placeholders without leaking secrets", () => {
  const { backend, frontend } = example();
  backend.MAIL_TRANSPORT = "file";
  backend.DB_USER = "root";
  backend.SMTP_URL = "smtps://SENSITIVE_VALUE@CHANGE_ME:465";
  assert.throws(
    () => validateProductionConfig(backend, frontend),
    (error) =>
      /MAIL_TRANSPORT/.test(error.message) &&
      /root/.test(error.message) &&
      !/SENSITIVE_VALUE/.test(error.message),
  );
});
