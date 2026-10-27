import { PageHeader } from "@homegrown/ui";
import { getT, resolveLocale } from "../../lib/server";
import { fill, shellCopy } from "../../lib/shell-copy";
import { requireSetup } from "../../lib/setup";
import { MoreView } from "./more-view";

export default async function MorePage() {
  await requireSetup();
  const locale = await resolveLocale();
  const t = await getT("core", locale);
  const copy = shellCopy(locale);
  const sha = process.env.HG_SHA ?? t("admin.versionLocal");
  return (
    <>
      <PageHeader title={copy.more} />
      <MoreView copy={copy} settings={t("nav.settings")} admin={t("nav.admin")} appInfoText={fill(copy.appInfoBody, { sha })} />
    </>
  );
}
