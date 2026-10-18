import { invoke } from "@homegrown/core/server";
import { PageHeader } from "@homegrown/ui";
import type { Entry } from "./functions";
import { ShoppingView } from "./view";

export default async function ShoppingListPage() {
  const entries = await invoke<Entry[]>("shopping-list", "listEntries");
  return (
    <>
      <PageHeader title="Einkaufsliste" description="Gemeinsam einkaufen, auch offline." />
      <ShoppingView initial={entries} />
    </>
  );
}
