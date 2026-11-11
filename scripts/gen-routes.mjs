// Regenerates src/routeTree.gen.ts without starting Vite (handy before `tsc`/CI). Vite does this automatically in dev/build.
import { Generator, getConfig } from "@tanstack/router-generator";
const config = getConfig(
  { routesDirectory: "./src/routes", generatedRouteTree: "./src/routeTree.gen.ts" },
  process.cwd(),
);
await new Generator({ config, root: process.cwd() }).run();
console.log("route tree generated");
