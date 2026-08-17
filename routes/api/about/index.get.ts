import { defineHandler } from "nitro/h3";
import { readFileSync } from "node:fs";

let cachedVersion = "0.0.0";
try {
  const raw = readFileSync(new URL("../../../package.json", import.meta.url), "utf-8");
  const j = JSON.parse(raw) as { version?: string };
  cachedVersion = j.version ?? "0.0.0";
} catch {
  // keep default
}

export default defineHandler(() => {
  return {
    name: "Metric BI",
    version: cachedVersion,
    license: "MIT",
    links: {
      github: "https://github.com/metrics-bi/metrics",
      docs: "https://metrics.example.com/docs",
    },
  };
});
