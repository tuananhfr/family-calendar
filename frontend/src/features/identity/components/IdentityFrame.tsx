import { Card } from "@/design/components";
export function IdentityFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mx-auto flex w-full max-w-xl flex-col gap-5 pb-8">
    <Card className="flex flex-col gap-5"><h1 className="text-2xl font-bold text-text">{title}</h1>{children}</Card>
  </section>;
}
