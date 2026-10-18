"use server";

import { revalidatePath } from "next/cache";
import { getFlag, log, setFlag } from "../../lib/server";

export async function togglePauseDeploys() {
  const next = !(await getFlag("pause_deploys"));
  await setFlag("pause_deploys", next);
  log.info("kill_switch", { status: next ? "paused" : "resumed" });
  revalidatePath("/admin");
}
