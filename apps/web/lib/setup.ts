import { redirect } from "next/navigation";
import { householdLocale } from "./server";

/** First run: the household picks its language before anything else renders. */
export async function requireSetup() {
  if (!(await householdLocale())) redirect("/setup");
}
