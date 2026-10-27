import { Button, Card, PageHeader, Select } from "@homegrown/ui";
import { getT, householdLocale, LOCALES, memberLocale } from "../../lib/server";
import { requireSetup } from "../../lib/setup";
import { chooseHouseholdLocale, chooseMemberLocale } from "./actions";

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
            <Select name="locale" label={t("settings.household")} hint={t("settings.householdHint")} defaultValue={household ?? "en"}>
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {t(`language.${l}`)}
                </option>
              ))}
            </Select>
            <Button>{t("settings.save")}</Button>
          </form>
        </Card>
        <Card>
          <form action={chooseMemberLocale} className="grid gap-3">
            <Select name="locale" label={t("settings.member")} defaultValue={member ?? ""}>
              <option value="">{t("settings.memberDefault")}</option>
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {t(`language.${l}`)}
                </option>
              ))}
            </Select>
            <Button>{t("settings.save")}</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
