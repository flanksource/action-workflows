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
<summary><strong>Create Draft Semantic Release</strong></summary>

Computes the next semantic version from commits using [`semantic-release`](https://github.com/semantic-release/semantic-release), which respects the repo's `.releaserc` / `release.config.*`, and creates a GitHub release. Configure `@semantic-release/github` with `draftRelease: true` in the calling repository to create the release in **draft** mode. Outputs the version and tag so downstream jobs can build artifacts and upload them before the release is published.

This exists because GitHub now enforces release immutability: once a release is published, you cannot add or change its assets. The flow is therefore:

```
create draft → build artifacts → upload artifacts → publish draft
```

**Usage:**

```yaml
jobs:
  create-draft:
    uses: flanksource/action-workflows/.github/workflows/create-draft-release.yml@main

  build:
    needs: create-draft
    if: needs.create-draft.outputs.published == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # ... build using needs.create-draft.outputs.version ...
      - name: Upload asset to draft release
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: gh release upload "${{ needs.create-draft.outputs.tag }}" ./dist/*

  publish:
    needs: [create-draft, build]
    if: needs.create-draft.outputs.published == 'true'
    uses: flanksource/action-workflows/.github/workflows/publish-release.yml@main
    with:
      tag: ${{ needs.create-draft.outputs.tag }}
```

**Inputs:**

- `semantic_version` (optional): Version of `semantic-release` to install (e.g., `24.2.3`). Defaults to the action's latest stable.
- `extra_plugins` (optional): Newline-separated list of extra `semantic-release` plugins to install (e.g., `conventional-changelog-conventionalcommits`).

**Outputs:**

- `published`: `'true'` when `semantic-release` determined a new version is due and a draft release was created. Always check this in dependent jobs.
- `version`: Computed semantic version without prefix (e.g., `1.2.3`). Empty when `published` is `'false'`.
- `tag`: Computed git tag including any prefix (e.g., `v1.2.3`). Empty when `published` is `'false'`.

**What it does:**

1. Checks out the calling repository with full history
2. Runs `semantic-release` normally so it creates the git tag, semantic-release notes, and GitHub release
3. The GitHub release is created as a draft when the calling repository configures `@semantic-release/github` with `draftRelease: true`

</details>

<details>
<summary><strong>Publish Draft Release</strong></summary>

Flips an existing draft release to published. Pair this with **Create Draft Semantic Release** at the end of a build pipeline once all artifacts have been uploaded.

**Usage:**

```yaml
jobs:
  publish:
    needs: [create-draft, build]
    uses: flanksource/action-workflows/.github/workflows/publish-release.yml@main
    with:
      tag: ${{ needs.create-draft.outputs.tag }}
```

**Inputs:**

- `tag` (required): Git tag of the draft release to publish (e.g., `v1.2.3`). Must match the tag output by `create-draft-release`.

**What it does:**

1. Runs `gh release edit <tag> --draft=false` against the calling repository, which publishes the release and creates the underlying git tag.

</details>
