import { Button, Card, PageHeader } from "@homegrown/ui";
import { getT, householdLocale, LOCALES, memberLocale } from "../../lib/server";
import { requireSetup } from "../../lib/setup";
import { chooseHouseholdLocale, chooseMemberLocale } from "./actions";

const selectClass = "min-h-11 w-full rounded-hg border border-border bg-surface px-3";

export default async function Settings() {
  await requireSetup();
  const [t, household, member] = await Promise.all([getT("core"), householdLocale(), memberLocale()]);
  return (
    <>
      <PageHeader title={t("settings.title")} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <form action={chooseHouseholdLocale} className="grid gap-3">
            <input type="hidden" name="next" value="/settings" />
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">{t("settings.household")}</span>
              <span className="text-fg-muted">{t("settings.householdHint")}</span>
              <select name="locale" defaultValue={household ?? "en"} className={selectClass}>
                {LOCALES.map((l) => (
                  <option key={l} value={l}>
                    {t(`language.${l}`)}
                  </option>
                ))}
              </select>
            </label>
            <Button>{t("settings.save")}</Button>
          </form>
        </Card>
        <Card>
          <form action={chooseMemberLocale} className="grid gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">{t("settings.member")}</span>
              <select name="locale" defaultValue={member ?? ""} className={selectClass}>
                <option value="">{t("settings.memberDefault")}</option>
                {LOCALES.map((l) => (
                  <option key={l} value={l}>
                    {t(`language.${l}`)}
                  </option>
                ))}
              </select>
            </label>
            <Button>{t("settings.save")}</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
