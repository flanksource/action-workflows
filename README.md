# action-workflows

Reusable GitHub Actions workflows for Flanksource projects.

## Workflows

### Push Helm Chart to flanksource/charts

A reusable workflow that pushes Helm charts to the [flanksource/charts](https://github.com/flanksource/charts) repository after a Helm build.

**Usage:**

The calling workflow must upload the packaged `.tgz` chart as an artifact (default name: `helm-chart`) before calling this workflow.

```yaml
jobs:
  helm-package:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # ... version updates, helm package, etc.
      - uses: actions/upload-artifact@v4
        with:
          name: helm-chart
          path: "*.tgz"

  push-helm-chart:
    needs: helm-package
    uses: flanksource/action-workflows/.github/workflows/push-helm-chart.yml@main
    with:
      filename_regex: "flanksource-ui-*.tgz"
      version: "1.4.180"
      pr_title: "Release 1.4.180 of flanksource/flanksource-ui"
    secrets:
      token: ${{ secrets.FLANKBOT }}
```

**Inputs:**

- `filename_regex` (required): Pattern to match the helm chart file (e.g., `flanksource-ui-*.tgz`)
- `version` (required): Chart version (e.g., `1.4.180`)
- `pr_title` (required): Title for the pull request (e.g., `Release 1.4.180 of flanksource/flanksource-ui`)
- `artifact_name` (optional, default: `helm-chart`): Name of the uploaded artifact containing the `.tgz` file(s)

**Secrets:**

- `token` (required): GitHub token with permissions to push to flanksource/charts repository

**What it does:**

1. Downloads the helm chart artifact from the calling workflow
2. Clones the flanksource/charts repository (gh-pages branch)
3. Creates a new branch for the chart update
4. Copies the helm chart file(s) matching the filename regex
5. Updates the helm repository index
6. Commits and pushes the changes
7. Creates a pull request
8. Auto-merges the pull request and deletes the branch