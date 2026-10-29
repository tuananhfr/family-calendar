"use client";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Phone, Trash2 } from "lucide-react";
import { db } from "@/core/db/db";
import { dialerUrl, saveEmergencyContact } from "@/core/emergency/contacts";
import { Button, Card, TextField } from "@/design/components";
import { t } from "@/i18n/vi";

export function EmergencyContacts({ spaceId }: { spaceId?: string }) {
  const contacts = useLiveQuery(() => spaceId ? db.emergencyContacts.where("spaceId").equals(spaceId).toArray() : db.emergencyContacts.toArray(), [spaceId]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("VN");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  return <Card className="flex flex-col gap-4">
    <h2 className="text-lg font-bold text-text">{t("emergency.contacts")}</h2>
    <p className="text-sm text-body">{t("emergency.contactsHelp")}</p>
    {!contacts?.length && <p className="text-sm text-muted">{t("emergency.noContacts")}</p>}
    <ul className="flex flex-col gap-3">{contacts?.map((contact) => {
      const href = typeof contact.phone === "string" ? dialerUrl(contact.phone) : null;
      if (!href) return null;
      const label = String(contact.name ?? "");
      return <li key={contact.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded-control border border-border p-3">
        <div className="min-w-0 flex-1"><p className="break-words font-semibold text-text">{label}</p><p className="text-sm text-body">{String(contact.phone)}</p></div>
        <a href={href} aria-label={t("emergency.openDialer", { name: label })} className="inline-flex min-h-[var(--touch-min)] items-center gap-2 rounded-control bg-primary px-3 font-semibold text-on-primary"><Phone aria-hidden className="size-4" />{t("emergency.contacts")}</a>
        <Button variant="ghost" aria-label={t("emergency.removeContact", { name: label })} onClick={() => void db.emergencyContacts.delete(contact.id).catch(() => setError(true))}><Trash2 aria-hidden className="size-4" /></Button>
      </li>;
    })}</ul>
    {spaceId && <form className="grid gap-3 sm:grid-cols-2" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setError(false);
      try { await saveEmergencyContact(spaceId, name, phone, country); setName(""); setPhone(""); }
      catch { setError(true); } finally { setBusy(false); }
    }}>
      <TextField label={t("emergency.contactName")} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
      <TextField label={t("emergency.phone")} value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" maxLength={30} required />
      <TextField label={t("emergency.country")} value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} maxLength={2} required />
      <Button type="submit" loading={busy} className="self-end">{t("emergency.addContact")}</Button>
    </form>}
    {error && <p role="alert" className="text-sm text-danger">{t("emergency.contactFailed")}</p>}
  </Card>;
}
