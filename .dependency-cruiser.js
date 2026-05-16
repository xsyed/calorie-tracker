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
      name: "no-backend-imports-into-ui",
      severity: "error",
      from: { path: "^packages/ui" },
      to: { path: "^apps/backend" },
      comment: "UI packages must not import from the backend.",
    },
    {
      name: "no-apps-imports-into-packages",
      severity: "error",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
      comment: "Shared packages must not depend on apps.",
    },
    {
      name: "no-mobile-imports-into-backend",
      severity: "error",
      from: { path: "^apps/backend" },
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
