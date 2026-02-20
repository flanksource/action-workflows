# action-workflows

Reusable GitHub Actions workflows for Flanksource projects.

## Workflows

### Push Helm Chart to flanksource/charts

A reusable workflow that pushes Helm charts to the [flanksource/charts](https://github.com/flanksource/charts) repository after a Helm build.

**Usage:**

```yaml
jobs:
  push-helm-chart:
    uses: flanksource/action-workflows/.github/workflows/push-helm-chart.yml@main
    with:
      filename_regex: "flanksource-ui-*.tgz"
      version: "1.4.180"
      pr_title: "Release 1.4.180 of flanksource/flanksource-ui"
    secrets:
      github_token: ${{ secrets.CHARTS_PUSH_TOKEN }}
```

**Inputs:**

- `filename_regex` (required): Pattern to match the helm chart file (e.g., `flanksource-ui-*.tgz`)
- `version` (required): Chart version (e.g., `1.4.180`)
- `pr_title` (required): Title for the pull request (e.g., `Release 1.4.180 of flanksource/flanksource-ui`)

**Secrets:**

- `github_token` (required): GitHub token with permissions to push to flanksource/charts repository

**What it does:**

1. Clones the flanksource/charts repository (gh-pages branch)
2. Creates a new branch for the chart update
3. Copies the helm chart file(s) matching the filename regex
4. Updates the helm repository index
5. Commits and pushes the changes
6. Creates a pull request
7. Auto-merges the pull request and deletes the branch