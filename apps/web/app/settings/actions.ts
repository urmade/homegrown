"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setHouseholdLocale, setMemberLocale } from "../../lib/server";

export async function chooseHouseholdLocale(form: FormData) {
  await setHouseholdLocale(String(form.get("locale")));
  revalidatePath("/", "layout");
  redirect(form.get("next") === "/settings" ? "/settings" : "/");
}

export async function chooseMemberLocale(form: FormData) {
  const locale = String(form.get("locale") ?? "");
  await setMemberLocale(locale === "" ? null : locale);
  revalidatePath("/", "layout");
  redirect("/settings");
}
