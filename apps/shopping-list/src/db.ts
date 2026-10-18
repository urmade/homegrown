import type { Generated } from "kysely";

export interface DB {
  "shopping_list.entries": {
    id: Generated<string>;
    title: string;
    quantity: Generated<number>;
    unit: string | null;
    done: Generated<boolean>;
    source: Generated<"manual" | "pantry">;
    added_by: string | null;
    created_at: Generated<Date>;
  };
}
