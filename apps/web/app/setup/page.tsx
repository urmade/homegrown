import { Button, Card } from "@homegrown/ui";
import { getT, LOCALES } from "../../lib/server";
import { chooseHouseholdLocale } from "../settings/actions";

export default async function Setup() {
  const t = await getT("core");
  return (
    <>
      <h1 className="mb-2 text-[length:var(--hg-text-title)] font-bold">{t("setup.title")}</h1>
      <p className="mb-6 text-fg-muted">{t("setup.question")}</p>
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
