# action-workflows

Reusable GitHub Actions workflows and composite actions for Flanksource projects.

## Versioning

Workflows and actions are published as semantic versions. Use the major-version tag (for example, `@v1`) to receive compatible updates, or pin a full release tag (for example, `@v1.0.0`) for a fixed version. Do not pin to the default branch.

## Actions

<details>
<summary><strong>Free Disk Space</strong></summary>

A composite action that reclaims the preinstalled toolchains a hosted Ubuntu runner ships with. A hosted runner leaves only ~14–21 GB free on `/` — which is where `/var/lib/docker` lives — so a multi-stage image build that also exports a `mode=max` layer cache can run out of space.

Derived from [`jlumbroso/free-disk-space`](https://github.com/jlumbroso/free-disk-space) (MIT), with inputs passed through `env:` instead of being templated into the script body, concurrent removals, free space measured on `/` alone, and no blanket `|| true`.

**Usage:**

```yaml
jobs:
  docker:
    runs-on: ubuntu-latest
    steps:
      - uses: flanksource/action-workflows/actions/free-disk-space@v1

      - uses: actions/checkout@v4
      # ... docker build ...
```

Opt in to the slower or more destructive categories when a build needs them:

```yaml
      - uses: flanksource/action-workflows/actions/free-disk-space@v1
        with:
          docker-images: true
          tool-cache: true
```

**Inputs:**

| Input | Default | Removes |
| --- | --- | --- |
| `android` | `true` | `/usr/local/lib/android` (~9–12 GB) |
| `dotnet` | `true` | `/usr/share/dotnet` (~1.6–2.9 GB) |
| `haskell` | `true` | `/opt/ghc`, `/usr/local/.ghcup` (~5 GB) |
| `boost` | `true` | `/usr/local/share/boost` (~1 GB) |
| `codeql` | `true` | `/opt/hostedtoolcache/CodeQL` (~5 GB) |
| `large-packages` | `false` | Large apt packages — costs 2–3 min |
| `docker-images` | `false` | All preloaded Docker images |
| `tool-cache` | `false` | The whole `$AGENT_TOOLSDIRECTORY` (~8 GB) |
| `swap-storage` | `false` | Swap and `/mnt/swapfile` |

With the defaults this reclaims roughly 20–25 GB on `ubuntu-latest` in ~30–45 s.

**What it does:**

1. Records available space on `/`
2. Removes each enabled category concurrently, failing the step if a removal genuinely errors
3. Applies the opt-in apt / Docker / swap categories
4. Reports space reclaimed to the log and the job summary

**Notes:**

- On `ubuntu-*-arm` runners most of these paths do not exist. `rm -rf` no-ops on an absent path, so the action is safe there and simply reports a smaller delta — no architecture conditional is needed.
- `codeql` is ignored when `tool-cache` is enabled, since the tool cache already contains it.
- `tool-cache` removes the directory `setup-go`, `setup-node`, and friends install into. Only enable it in a job that runs no `setup-*` action.

</details>

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
    uses: flanksource/action-workflows/.github/workflows/push-helm-chart.yml@v1
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

Computes the next semantic version from commits using [`semantic-release`](https://github.com/semantic-release/semantic-release), which respects the repo's `.releaserc` / `release.config.*`, and creates a GitHub release. Outputs the version and tag for downstream jobs. Callers can install extra plugins when their release config needs them.

**Usage:**

```yaml
jobs:
  create-release:
    uses: flanksource/action-workflows/.github/workflows/create-release.yml@v1
    with:
      extra_plugins: |
        @semantic-release/git
    secrets:
      token: ${{ secrets.FLANKBOT }}

  build:
    needs: create-release
    if: needs.create-release.outputs.published == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # ... build using needs.create-release.outputs.version ...
```

**Inputs:**

- `extra_plugins` (optional): newline-separated semantic-release plugins to install, such as `@semantic-release/git`.

**Secrets:**

- `token` (required): token used for checkout, git push, and GitHub release operations.

**Outputs:**

- `published`: `'true'` when `semantic-release` determined a new version is due and a release was created. Always check this in dependent jobs.
- `version`: Computed semantic version without prefix (e.g., `1.2.3`). Empty when `published` is `'false'`.
- `tag`: Computed git tag including any prefix (e.g., `v1.2.3`). Empty when `published` is `'false'`.

**What it does:**

1. Checks out the calling repository with full history
2. Runs `semantic-release` normally so it creates the git tag, semantic-release notes, and GitHub release

</details>

<details>
<summary><strong>Publish Docker Image</strong></summary>

Builds and pushes Docker images with [`docker/build-push-action`](https://github.com/docker/build-push-action). Optionally signs the pushed image digest using cosign keyless signing through GitHub Actions OIDC. Cosign signing is enabled by default.

**Usage:**

```yaml
jobs:
  docker:
    uses: flanksource/action-workflows/.github/workflows/publish-docker-image.yml@v1
    permissions:
      contents: read
      id-token: write
      packages: write
    with:
      dockerfile: build/Dockerfile
      context: .
      platforms: linux/amd64,linux/arm64
      image_tags: |
        docker.io/flanksource/config-db:v1.2.3
        docker.io/flanksource/config-db:latest
        ghcr.io/flanksource/config-db:v1.2.3
        public.ecr.aws/k4y9r6y5/config-db:v1.2.3
      login_to_ecr: true
      ecr_registry_type: public
      cosign: true
    secrets:
      docker_username: ${{ secrets.DOCKER_USERNAME }}
      docker_password: ${{ secrets.DOCKER_PASSWORD }}
      aws_access_key_id: ${{ secrets.ECR_AWS_ACCESS_KEY }}
      aws_secret_access_key: ${{ secrets.ECR_AWS_SECRET_ACCESS_KEY }}
```

**Inputs:**

- `image_tags` (required): Newline-separated full image tags to publish.
- `dockerfile` (optional, default: `Dockerfile`): Path to the Dockerfile.
- `context` (optional, default: `.`): Docker build context.
- `platforms` (optional, default: `linux/amd64`): Comma-separated target platforms.
- `build_args` (optional): Newline-separated Docker build args.
- `cosign` (optional, default: `true`): Sign pushed image digests using cosign keyless.
- `login_to_dockerhub` (optional, default: `true`): Log in to Docker Hub.
- `login_to_ecr` (optional, default: `false`): Log in to Amazon ECR.
- `ecr_registry_type` (optional, default: `public`): Amazon ECR registry type: `public` or `private`.
- `aws_region` (optional, default: `us-east-1`): AWS region used for ECR login.

**Secrets:**

- `docker_username` / `docker_password`: Required when `login_to_dockerhub` is `true`.
- `ghcr_username` / `ghcr_token`: Optional for `ghcr.io` tags. Defaults to `github.actor` / `GITHUB_TOKEN`.
- `aws_access_key_id` / `aws_secret_access_key`: Required when `login_to_ecr` is `true`.

**Outputs:**

- `digest`: Published image digest from `docker/build-push-action`.

**What it does:**

1. Hardens the runner with `step-security/harden-runner` in audit mode
2. Frees disk space on the hosted runner
3. Checks out the calling repository
4. Logs in to Docker Hub and/or Amazon ECR as requested, and logs in to GHCR when `ghcr.io` tags are present
5. Builds and pushes the configured image tags
6. Installs cosign when `cosign` is enabled
7. Signs each unique image repository by digest, e.g. `repo/image@sha256:...`

</details>

<details>
<summary><strong>Publish Draft Release</strong></summary>

Flips an existing draft release to published at the end of a build pipeline once all artifacts have been uploaded.

**Usage:**

```yaml
jobs:
  publish:
    needs: [create-release, build]
    uses: flanksource/action-workflows/.github/workflows/publish-release.yml@v1
    with:
      tag: ${{ needs.create-release.outputs.tag }}
    secrets:
      token: ${{ secrets.FLANKBOT }}
```

**Inputs:**

- `tag` (required): Git tag of the draft release to publish (e.g., `v1.2.3`).

**Secrets:**

- `token` (required): token used to publish the draft GitHub release.

**What it does:**

1. Runs `gh release edit <tag> --draft=false` against the calling repository, which publishes the release and creates the underlying git tag.

</details>
