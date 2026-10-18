import { boot } from "@homegrown/core/server";
import { modules } from "../../../.homegrown/registry.server";

boot(modules);

export * from "@homegrown/core/server";
export { modules };
