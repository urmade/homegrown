import { getMessages, invoke, translator } from "@homegrown/core/server";
import { PageHeader } from "@homegrown/ui";
import type { Item } from "./functions";
import { PantryView } from "./view";

export default async function Page() {
  const [rows, messages] = await Promise.all([invoke<Item[]>("pantry", "listItems"), getMessages("pantry")]);
  const t = translator(messages);
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <PantryView initial={rows} messages={messages} />
    </>
  );
}
