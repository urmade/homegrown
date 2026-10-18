import { invoke } from "@homegrown/core/server";
import { PageHeader } from "@homegrown/ui";
import type { Item } from "./functions";
import { PantryView } from "./view";

export default async function PantryPage() {
  const items = await invoke<Item[]>("pantry", "listItems");
  return (
    <>
      <PageHeader title="Vorrat" description="Was da ist und was nachgekauft werden muss." />
      <PantryView initial={items} />
    </>
  );
}
