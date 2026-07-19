# Release process

## Before a release

```bash
npm ci
npm run check
npm run test:coverage
npm pack --dry-run
```

Review the package contents, update `CHANGELOG.md`, and verify the example report.

## Versioning

Use semantic versions:

- patch: bug fixes and false-positive reductions;
- minor: backward-compatible rules or outputs;
- major: breaking configuration, output schema, or runtime changes.

## GitHub Action tags

Create an immutable release tag such as `v1.1.0`. After verification, move the major convenience tag `v1` to the release commit. Users who need maximum reproducibility can pin the full commit SHA.

## npm

The package is optional; GitHub Action users do not need npm. For npm publication, prefer trusted publishing and provenance. The first publication may require interactive setup before the trusted publisher can be configured.

## Rollback

Do not silently rewrite a release-specific tag. Publish a corrective patch release. Move the major convenience tag only after the corrective release is verified.
