/** @type {import("dependency-cruiser").IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-cross-feature-imports",
      severity: "error",
      from: { path: "^apps/mobile/src/features/([^/]+)" },
      to: {
        path: "^apps/mobile/src/features/([^/]+)",
        pathNot: "^apps/mobile/src/features/$1",
      },
      comment: "Features must not import from other features. Use shared packages.",
    },
    {
      name: "no-api-imports-into-ui",
      severity: "error",
      from: { path: "^packages/ui" },
      to: { path: "^apps/api" },
      comment: "UI packages must not import from the API.",
    },
    {
      name: "no-apps-imports-into-packages",
      severity: "error",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
      comment: "Shared packages must not depend on apps.",
    },
    {
      name: "no-mobile-imports-into-api",
      severity: "error",
      from: { path: "^apps/api" },
      to: { path: "^apps/mobile" },
      comment: "The backend must not import from the mobile app.",
    },
    {
      name: "no-circular-deps",
      severity: "error",
      from: {},
      to: { circular: true },
      comment: "Circular dependencies are forbidden.",
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "tsconfig.json",
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
  },
};
