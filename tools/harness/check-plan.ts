import { changedFiles, done, fail, read } from "./lib";
import { planItems } from "./plan-items";

/**
 * Plan before code: every new dependency, module, table or cross-module call needs a line in the
 * "## Plan" section of a spec changed in this PR that names it in backticks and says why nothing existing works.
 */
const items = planItems();
const specs = changedFiles()
  .filter((c) => /^docs\/specs\/[^/]+\.md$/.test(c.path) && c.status !== "D")
  .map((c) => c.path);
const planLines = specs.flatMap((s) => {
  const plan = /^## Plan\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(read(s))?.[1] ?? "";
  if (!plan.trim()) fail(`${s}: missing "## Plan" section`);
  return plan.split("\n");
});

for (const item of items) {
  const line = planLines.find((l) => l.includes(`\`${item.name}\``));
  if (!line) fail(`new ${item.kind} \`${item.name}\` has no reason in a spec plan (docs/specs/<id>.md, "## Plan")`);
  else if (line.replace(`\`${item.name}\``, "").trim().split(/\s+/).length < 6) fail(`plan line for \`${item.name}\` needs a real reason: "${line.trim()}"`);
}
done(`check-plan (${items.length} new item(s))`);
