import { changedFiles, done, fail, read } from "./lib";
import { planItems } from "./plan-items";

/**
 * Plan before code: every new dependency, module, table or cross-module call needs a line in the
 * "## Plan" section of a spec changed in this PR that names it in backticks and says why nothing existing works.
 * Fix the flow, not the symptom: every changed spec's plan lists at least two failure modes of the flow it touches.
 */
const items = planItems();
const specs = changedFiles()
  .filter((c) => /^docs\/specs\/[^/]+\.md$/.test(c.path) && c.status !== "D")
  .map((c) => c.path);
const planLines = specs.flatMap((s) => {
  const plan = /^## Plan\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(read(s))?.[1] ?? "";
  if (!plan.trim()) fail(`${s}: missing "## Plan" section`);
  const lines = plan.split("\n");
  const start = lines.findIndex((l) => /^-\s*Failure modes\b/i.test(l));
  const rest = start < 0 ? [] : lines.slice(start + 1);
  const end = rest.findIndex((l) => l.trim() && !/^\s+-\s/.test(l));
  const modes = (end < 0 ? rest : rest.slice(0, end)).filter((l) => /^\s+-\s+\S/.test(l));
  if (start < 0) fail(`${s}: plan needs a "- Failure modes of <flow>:" list covering the end-to-end flow touched`);
  else if (modes.length < 2)
    fail(`${s}: failure-mode list has fewer than two entries; enumerate every way the flow can fail, not just the symptom`);
  return lines;
});

for (const item of items) {
  const line = planLines.find((l) => l.includes(`\`${item.name}\``));
  if (!line) fail(`new ${item.kind} \`${item.name}\` has no reason in a spec plan (docs/specs/<id>.md, "## Plan")`);
  else if (line.replace(`\`${item.name}\``, "").trim().split(/\s+/).length < 6)
    fail(`plan line for \`${item.name}\` needs a real reason: "${line.trim()}"`);
}
done(`check-plan (${items.length} new item(s))`);
