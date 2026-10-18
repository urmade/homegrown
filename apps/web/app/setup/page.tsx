import { Button, Card, PageHeader } from "@homegrown/ui";
import { getT, LOCALES } from "../../lib/server";
import { chooseHouseholdLocale } from "../settings/actions";

export default async function Setup() {
  const t = await getT("core");
  return (
    <>
      <PageHeader title={t("setup.title")} description={t("setup.question")} />
      <Card className="max-w-md">
        <div className="grid gap-3">
          {LOCALES.map((locale) => (
            <form key={locale} action={chooseHouseholdLocale}>
              <input type="hidden" name="locale" value={locale} />
              <Button className="w-full" lang={locale}>
                {t(`language.${locale}`)}
              </Button>
            </form>
          ))}
        </div>
      </Card>
    </>
  );
}
