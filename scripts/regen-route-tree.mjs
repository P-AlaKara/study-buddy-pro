// Regenerate src/routeTree.gen.ts without starting the dev server.
// Usage: node scripts/regen-route-tree.mjs
//
// The TanStack Start Vite plugin appends a `Register` footer to the generated
// file; the bare generator does not, and without it router types degrade to
// `any` (e.g. Route.useSearch() in quiz.play). Pass it explicitly, as ONE string.
import { Generator, getConfig } from "@tanstack/router-generator";

const root = process.cwd();
const routeTreeFileFooter = [
  [
    "import type { getRouter } from './router.tsx'",
    "import type { startInstance } from './start.ts'",
    "declare module '@tanstack/react-start' {",
    "  interface Register {",
    "    ssr: true",
    "    router: Awaited<ReturnType<typeof getRouter>>",
    "    config: Awaited<ReturnType<typeof startInstance.getOptions>>",
    "  }",
    "}",
  ].join("\n"),
];
const config = getConfig(
  {
    routesDirectory: "src/routes",
    generatedRouteTree: "src/routeTree.gen.ts",
    routeTreeFileFooter,
  },
  root,
);
await new Generator({ config, root }).run();
console.log("Regenerated src/routeTree.gen.ts");
