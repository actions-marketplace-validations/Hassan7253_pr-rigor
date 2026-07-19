<!-- pr-rigor-report -->
## PR Rigor report

**Status:** 🛑 FAIL &nbsp; **Readiness score:** 29/100

Changed files: **4** · Lines: **+214 / -28** · Source: **1** · Tests: **0**

| Category | Check | Result | Detail |
|---|---|---:|---|
| Description | PR checklist is incomplete | ⚠️ WARN | 1 unchecked checklist item remains. |
| Testing | Code changed without test changes | ⚠️ WARN | 1 source file changed and no test file changed. |
| Release | No changelog entry detected | ⚠️ WARN | Source code changed but no configured changelog or changeset path changed. |
| Supply chain | Dependency surface changed | ⚠️ WARN | 1 dependency manifest changed. |
| Supply chain | Manifest changed without lockfile | ℹ️ INFO | A dependency manifest changed without a detected lockfile update. |
| Security | Sensitive paths changed | ⚠️ WARN | 2 security-sensitive paths changed. |
| Security | Broad workflow permissions added | 🛑 FAIL | New broad GitHub Actions write permissions were detected. |
| Operations | Migration or schema changed | ⚠️ WARN | 1 migration or schema file changed. |
| Supply chain | Third-party Action is not SHA-pinned | ⚠️ WARN | 1 newly added third-party Action reference is not pinned to a full commit SHA. |

<details><summary>⚠️ PR checklist is incomplete</summary>

**Evidence**
- `Add focused tests before merge`

**Next step:** Complete the checklist or explain why an item does not apply.

</details>

<details><summary>⚠️ Code changed without test changes</summary>

**Evidence**
- `src/release.js — source change`

**Next step:** Add focused tests or explain why existing coverage is sufficient.

</details>

<details><summary>⚠️ No changelog entry detected</summary>

**Next step:** Add a release note or mark the change as internal through a maintainer-controlled waiver label.

</details>

<details><summary>⚠️ Dependency surface changed</summary>

**Evidence**
- `package.json — dependency manifest`

**Next step:** Review install scripts, version ranges, licenses, lockfiles, and supply-chain impact.

</details>

<details><summary>ℹ️ Manifest changed without lockfile</summary>

**Evidence**
- `package.json — manifest without lockfile`

**Next step:** Confirm that the repository intentionally does not commit a lockfile, or update it.

</details>

<details><summary>⚠️ Sensitive paths changed</summary>

**Evidence**
- `.github/workflows/release.yml — sensitive path`
- `db/migrations/20260719_add_release.sql — sensitive path`

**Next step:** Request an owner familiar with authentication, permissions, workflows, or deployment risk.

</details>

<details><summary>🛑 Broad workflow permissions added</summary>

**Evidence**
- `.github/workflows/release.yml — new broad write permission`

**Next step:** Use the narrowest job-level permissions and document why each write permission is needed.

</details>

<details><summary>⚠️ Migration or schema changed</summary>

**Evidence**
- `db/migrations/20260719_add_release.sql — migration or schema`

**Next step:** Document rollback, compatibility, data volume, and deployment ordering.

</details>

<details><summary>⚠️ Third-party Action is not SHA-pinned</summary>

**Evidence**
- `.github/workflows/release.yml — some-vendor/publish-action@main`

**Next step:** Pin third-party Actions to a reviewed 40-character commit SHA and retain a version comment.

</details>

> Deterministic signals reduce review setup time. They do not decide whether a change is correct or should be merged.

