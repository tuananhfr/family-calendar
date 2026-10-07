"use client";

import { useState } from "react";
import { saveBlob } from "@/core/platform/download";
import { toast } from "@/design/components";
import { t } from "@/i18n/vi";
import { buildFinanceWorkbook, type FinanceExportData } from "../model/export-xlsx";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Builds the month's XLSX on the device and hands it to the browser's download. Nothing leaves the device. */
export function useFinanceExport() {
  const [busy, setBusy] = useState(false);
  const exportMonth = async (month: string, data: FinanceExportData) => {
    setBusy(true);
    try {
      const buffer = await buildFinanceWorkbook(month, data);
      const file = `tai-chinh-${month}.xlsx`;
      saveBlob(new Blob([buffer], { type: XLSX_TYPE }), file);
      toast(t("finance.report.exported", { file }), "success");
    } catch (e) {
      console.error(e);
      toast(t("finance.report.exportFailed"), "error");
    } finally {
      setBusy(false);
    }
  };
  return { exportMonth, busy };
}
