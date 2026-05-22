**Actionable comments posted: 10**

<details>
<summary>🤖 Prompt for all review comments with AI agents</summary>

```
Verify each finding against current code. Fix only still-valid issues, skip the
rest with a brief reason, keep changes minimal, and validate.

Inline comments:
In `@app/api/integrations/github/repositories/route.ts`:
- Around line 92-95: The 429 response uses NextResponse.json but doesn't set the
HTTP Retry-After header; update the return that calls NextResponse.json (the
block returning { error: error.message, retryAfter: error.retryAfterSeconds })
to include a headers option with 'Retry-After' set to
String(error.retryAfterSeconds) (or omit/skip the header when retryAfterSeconds
is undefined) so clients receive the standard Retry-After header along with the
429 status.
- Around line 82-87: The fallback branch currently returns all DB repos and
hardcodes page:1 and per_page:repos.length; update the DB fallback in route
handler to read the requested page and per_page parameters (same parsing logic
used in the token path), compute start/end indices, slice the repositories array
(or repos) to the requested page, and return that slice with page and per_page
set to the requested/derived values and source:"github-app-db" so pagination
semantics match the token path.

In `@GITHUB_RATELIMIT_IMPLEMENTATION.md`:
- Line 47: Choose a single concrete timeout budget (either 10 seconds or 10
minutes) and update the two conflicting phrases so they match that chosen
budget: replace the parenthetical "safe for Vercel 10-second timeout" phrase in
the sentence containing "Single-page fetching by default" and the "worst-case
latency is under a 10-minute timeout" sentence so both reference the same
timeout value, and then adjust any nearby SLO/rollback language to use that
unified timeout budget consistently throughout the document.

In `@IMPLEMENTATION_CHECKLIST.md`:
- Around line 142-152: The checklist currently asserts "Implementation complete
and ready for testing" but tests are placeholders and don't verify
retry/pagination/end-to-end behavior; either add concrete tests (create
tests/retry.test.ts to validate retry/backoff and `retryAfter` handling, and
tests/pagination.test.ts to validate pagination defaults and edge cases, plus
integration-style checks for rate-limit behavior) or downgrade the checklist
language (change the header from "Implementation complete and ready for
testing." to "Implementation implemented — pending verification" and mark
Estimated Impact as "Expected (untested)" and add a TODO linking the new test
files) so the document no longer signals false readiness.

In `@lib/services/githubService.test.ts`:
- Around line 10-89: Replace the placeholder assertions with real mocked tests
that exercise GitHubService behavior: for the "paginated repositories" and
"getPullRequestFiles" tests mock HTTP responses (using nock or jest-mock-axios)
to verify Link header parsing, per_page/page defaults, nextPage metadata,
aggregation across pages, and stopping when items < per_page or when max_pages
reached; for rate-limit and retry tests mock responses with 429 + Retry-After
and transient 502/503/504 errors to assert withRetry behavior (exponential
backoff, honoring Retry-After) and that GitHubRateLimitError.retryAfterSeconds
is used and thrown after max retries; similarly replace single-resource
placeholders for getAuthenticatedUser, getRepository, and getBranches to assert
retries on transient failures, that getRepository returns null on 404, and
getBranches returns [] on 404 while other errors are sanitized via
sanitizeGitHubError.

In `@lib/services/githubService.ts`:
- Around line 236-239: The call to this.client.get(...) is double-retried
because both the Axios interceptor and withRetry(...) implement retries; pick
one layer and remove the other. E.g., remove the withRetry wrapper around the
repo fetch in githubService.ts (the block using withRetry(() =>
this.client.get(`/repos/${owner}/${repo}`), { maxRetries: 3 })) so the Axios
interceptor alone handles retries, and keep any downstream error
normalization/throwing logic intact; alternatively, if you prefer withRetry as
the single retry policy, disable retry logic in the Axios interceptor and keep
the withRetry call—ensure only one of withRetry or the interceptor performs
retry/backoff to avoid compounded attempts.
- Around line 258-296: The stray top-level await block that calls withRetry(()
=> this.client.get("/user")) and returns response.data must be moved into a
proper async method (e.g. add async getCurrentUser(): Promise<GitHubUser | null>
or similar) inside the class instead of sitting in the class body; create that
method using the same withRetry pattern and return type, and remove the
duplicate getRepository implementation so only the correct async
getRepository(owner: string, repo: string): Promise<GitHubRepository | null>
remains. Ensure you replace the inline console/return statements with the method
body, keep error handling consistent (use isAxiosError and sanitizeGitHubError
as used in getRepository), and update any callers to use the new getCurrentUser
(or chosen name).
- Around line 568-574: postPullRequestComment currently wraps the POST to
/issues/.../comments (and the fallback to /pulls/.../reviews) with withRetry
which can replay state-changing requests; update postPullRequestComment to avoid
broad retries: either restrict withRetry to only handle explicit 429/Retry-After
responses (do not retry on generic network errors or 5xx) or implement an
idempotency/dedupe step before replaying (e.g., generate a unique token per
comment and have postPullRequestComment scan existing comments via
this.client.get for that token before posting and skip/post-once accordingly).
Locate uses of withRetry and the postPullRequestComment function to apply the
change and ensure any retry policy only retries safe 429/Retry-After cases or
uses the token-check flow to prevent duplicate comments.
- Around line 632-635: There is a stray throw and unbalanced braces in
GitHubService: remove the out-of-scope "throw sanitizeGitHubError(error);" that
appears immediately after getLanguages(), delete the duplicate async
getBranches(...) implementation (keep the correct one — identify both by their
method name getBranches and their locations around line ~419 and ~717), and
remove the extra closing brace after the second getBranches to restore the class
structure; ensure sanitizeGitHubError is only used inside catch blocks where
"error" is in scope and run a quick compile to verify class braces are balanced.
- Around line 206-223: The interceptor currently retries HTTP 409 because
retryStatusCodes = [409, 502, 503, 504]; remove 409 from that array (use [502,
503, 504]) so 409 responses are not retried globally; keep the existing retry
logic (config.retryCount, backoff, this.client(config)) unchanged so transient
502/503/504 still retry, and allow getCommits()'s existing 409 handling to
return [] as intended.
```

</details>

<details>
<summary>🪄 Autofix (Beta)</summary>

Fix all unresolved CodeRabbit comments on this PR:

- [ ] <!-- {"checkboxId": "4b0d0e0a-96d7-4f10-b296-3a18ea78f0b9"} --> Push a commit to this branch (recommended)
- [ ] <!-- {"checkboxId": "ff5b1114-7d8c-49e6-8ac1-43f82af23a33"} --> Create a new PR with the fixes

</details>

---

<details>
<summary>ℹ️ Review info</summary>

<details>
<summary>⚙️ Run configuration</summary>

**Configuration used**: Organization UI

**Review profile**: CHILL

**Plan**: Pro Plus

**Run ID**: `a0ffcaf8-ad74-4924-aac4-8faf157b5bc5`

</details>

<details>
<summary>📥 Commits</summary>

Reviewing files that changed from the base of the PR and between 426548cb8bfbda77e5719b983254a3f248e770d8 and 29383f5a2ffa1da68de508b93b8799eb076d4602.

</details>

<details>
<summary>📒 Files selected for processing (5)</summary>

* `GITHUB_RATELIMIT_IMPLEMENTATION.md`
* `IMPLEMENTATION_CHECKLIST.md`
* `app/api/integrations/github/repositories/route.ts`
* `lib/services/githubService.test.ts`
* `lib/services/githubService.ts`

</details>

</details>

<!-- This is an auto-generated comment by CodeRabbit for review status -->