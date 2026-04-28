# action-workflows

Reusable GitHub Actions workflows for Flanksource projects.

## Workflows

<details>
<summary><strong>Push Helm Chart to flanksource/charts</strong></summary>

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

</details>

<details>
<summary><strong>Create Semantic Release</strong></summary>

Computes the next semantic version from commits using [`semantic-release`](https://github.com/semantic-release/semantic-release), which respects the repo's `.releaserc` / `release.config.*`, and creates a GitHub release. Outputs the version and tag for downstream jobs.

**Usage:**

```yaml
jobs:
  create-release:
    uses: flanksource/action-workflows/.github/workflows/create-release.yml@main

  build:
    needs: create-release
    if: needs.create-release.outputs.published == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # ... build using needs.create-release.outputs.version ...
```

**Outputs:**

- `published`: `'true'` when `semantic-release` determined a new version is due and a release was created. Always check this in dependent jobs.
- `version`: Computed semantic version without prefix (e.g., `1.2.3`). Empty when `published` is `'false'`.
- `tag`: Computed git tag including any prefix (e.g., `v1.2.3`). Empty when `published` is `'false'`.

**What it does:**

1. Checks out the calling repository with full history
2. Runs `semantic-release` normally so it creates the git tag, semantic-release notes, and GitHub release

</details>

<details>
<summary><strong>Publish Draft Release</strong></summary>

Flips an existing draft release to published at the end of a build pipeline once all artifacts have been uploaded.

**Usage:**

```yaml
jobs:
  publish:
    needs: [create-release, build]
    uses: flanksource/action-workflows/.github/workflows/publish-release.yml@main
    with:
      tag: ${{ needs.create-release.outputs.tag }}
```

**Inputs:**

- `tag` (required): Git tag of the draft release to publish (e.g., `v1.2.3`).

**What it does:**

1. Runs `gh release edit <tag> --draft=false` against the calling repository, which publishes the release and creates the underlying git tag.

</details>
