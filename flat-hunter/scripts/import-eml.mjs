import path from "node:path";
import {
  importEmailFile,
  readStore,
  writeStore,
} from "./lib/alert-importer.mjs";

const files = process.argv.slice(2);

if (files.length === 0) {
  console.error("Usage: npm run import:eml -- path/to/alert.eml [...]");
  process.exit(1);
}

const store = readStore();
const results = files.map((file) => ({
  file,
  ...importEmailFile(store, file),
}));
writeStore(store);

for (const result of results) {
  const label = path.basename(result.file);
  if (result.skipped) {
    console.log(`${label}: skipped, already imported`);
  } else {
    console.log(`${label}: ${result.imported} imported, ${result.updated} updated`);
  }
}
