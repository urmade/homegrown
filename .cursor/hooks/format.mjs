import { readInput, relPath, sh } from "./lib.mjs";

// Soft: formats the edited file; CI does not depend on it.
const input = await readInput();
const file = relPath(input.file_path);
if (/\.(ts|tsx|mjs|json|css|md)$/.test(file) && !file.includes(".generated")) sh("pnpm", ["exec", "prettier", "--print-width", "140", "--write", file]);
process.stdout.write("{}\n");
