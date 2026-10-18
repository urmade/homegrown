import { EmptyState, PageHeader } from "@homegrown/ui";
import { getT } from "../../lib/server";

export default async function Offline() {
  const t = await getT("core");
  return (
    <>
      <PageHeader title={t("offline.title")} />
      <EmptyState>{t("offline.body")}</EmptyState>
    </>
  );
}
