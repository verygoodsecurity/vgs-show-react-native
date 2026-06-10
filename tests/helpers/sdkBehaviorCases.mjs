import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesRoot = path.resolve(__dirname, "../fixtures");

export function loadSdkBehaviorCases(area) {
  const areaRoot = path.join(fixturesRoot, area);
  return readdirSync(areaRoot)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => JSON.parse(readFileSync(path.join(areaRoot, name), "utf8")));
}
