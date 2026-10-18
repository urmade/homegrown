import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { pages } from "../../../../../.homegrown/registry.pages";
import "../../../lib/server";
import { requireSetup } from "../../../lib/setup";

export const dynamic = "force-dynamic";

export default async function ModulePage({ params }: { params: Promise<{ module: string; path?: string[] }> }) {
  const { module, path = [] } = await params;
  const Page = pages[module];
  if (!Page) notFound();
  await requireSetup();
  return (await Page({ path })) as ReactNode;
}
