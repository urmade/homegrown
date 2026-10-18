import type { Generated } from "kysely";

export interface DB {
  "pantry.items": {
    id: Generated<string>;
    name: string;
    unit: Generated<string>;
    quantity: Generated<number>;
    min_quantity: Generated<number>;
    updated_by: string | null;
    updated_at: Generated<Date>;
  };
}
