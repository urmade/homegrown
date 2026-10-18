import { getMessages, invoke, translator } from "@homegrown/core/server";
import { PageHeader } from "@homegrown/ui";
import type { Entry } from "./functions";
import { ShoppingView } from "./view";

export default async function Page() {
  const [rows, messages] = await Promise.all([invoke<Entry[]>("shopping-list", "listEntries"), getMessages("shopping-list")]);
  const t = translator(messages);
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <ShoppingView initial={rows} messages={messages} />
    </>
  );
}
