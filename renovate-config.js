module.exports = {
  platform: "github",

  // Discover every repository that the GitHub App can access in the organization.
  autodiscover: true,
  autodiscoverFilter: ["flanksource/*"],

  // This is the only Renovate configuration. Consumer repositories do not need
  // an onboarding PR or a renovate.json file, and cannot override these rules.
  onboarding: false,
  requireConfig: "ignored",

  // Keep branches separate from branches created by the hosted Renovate app.
  branchPrefix: "renovate-flanksource/",

  // GitHub App API commits are signed as verified commits by GitHub.
  platformCommit: "enabled",

  // Dependabot owns security updates. Renovate owns normal version updates for
  // dependencies published by Flanksource.
  osvVulnerabilityAlerts: false,
  vulnerabilityAlerts: {
    enabled: false,
  },

  packageRules: [
    {
      description: "Disable updates for every dependency by default",
      matchPackageNames: ["*"],
      enabled: false,
    },
    {
      description: "Enable dependencies with a Flanksource package name",
      matchPackageNames: [
        "flanksource/**",
        "github.com/flanksource/**",
        "ghcr.io/flanksource/**",
        "docker.io/flanksource/**",
        "quay.io/flanksource/**",
        "@flanksource/**",
      ],
      enabled: true,
    },
    {
      description: "Enable dependencies sourced from a Flanksource repository",
      matchSourceUrls: ["https://github.com/flanksource/**"],
      enabled: true,
    },
  ],
};
