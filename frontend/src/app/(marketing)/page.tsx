import type { Metadata } from "next";
import { publicPageMetadata } from "@/core/seo/metadata";
import { StructuredData } from "@/core/seo/StructuredData";
import { LandingPage } from "@/features/landing/components/LandingPage";

export const metadata: Metadata = publicPageMetadata("home");

export default function HomePage() {
  return <><StructuredData /><LandingPage /></>;
}
