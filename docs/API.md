# API Documentation

This document describes the GitHub integration endpoints used by GitVerse.

## Authentication

Most endpoints require authentication.

Authentication is validated through the application's authentication middleware.

Possible authentication errors:

| Status | Description |
|----------|-------------|
| 401 | Unauthorized |
| 403 | Forbidden |

---

# GitHub Integration APIs

## Connect GitHub Account

### Endpoint

```http
POST /api/integrations/github/connect
```

### Description

Connects a GitHub account using a Personal Access Token and stores the account information for the authenticated user.

### Authentication

Required

### Request Body

```json
{
  "token": "github_personal_access_token"
}
```

### Success Response

Status: `200 OK`

```json
{
  "account": {
    "id": 1,
    "userId": "user-id",
    "githubUserId": "123456",
    "username": "octocat",
    "createdAt": "2026-05-23T10:00:00Z",
    "updatedAt": "2026-05-23T10:00:00Z"
  }
}
```

### Error Responses

#### Missing Token

Status: `400 Bad Request`

```json
{
  "error": "GitHub token is required"
}
```

#### Internal Error

Status: `500 Internal Server Error`

```json
{
  "error": "Failed to connect GitHub"
}
```

---

## List GitHub Repositories

### Endpoint

```http
POST /api/integrations/github/repositories
```

### Description

Fetches repositories associated with the authenticated user's GitHub account.

Supports:

- Personal Access Token flow
- GitHub App integration fallback

### Authentication

Required

### Request Body

```json
{
  "token": "github_personal_access_token",
  "username": "octocat"
}
```

Both fields are optional if a GitHub account is already connected.

### Success Response

Status: `200 OK`

```json
{
  "repositories": [
    {
      "id": 123,
      "full_name": "octocat/hello-world",
      "private": false,
      "html_url": "https://github.com/octocat/hello-world"
    }
  ],
  "source": "user-token"
}
```

### Alternative Response (GitHub App)

```json
{
  "repositories": [
    {
      "id": 1,
      "full_name": "owner/repository",
      "private": true,
      "html_url": "https://github.com/owner/repository",
      "_source": "db",
      "_enabled": true
    }
  ],
  "source": "github-app-db"
}
```

### Error Responses

Status: `400 Bad Request`

```json
{
  "error": "No GitHub token or GitHub App repos found in DB."
}
```

Status: `500 Internal Server Error`

```json
{
  "error": "Failed to fetch GitHub repositories"
}
```

---

## Generate GitHub App Installation URL

### Endpoint

```http
POST /api/integrations/github/app/install-url
```

### Description

Generates a GitHub App installation URL for the authenticated user.

### Authentication

Required

### Request Body

No request body required.

### Success Response

Status: `200 OK`

```json
{
  "url": "https://github.com/apps/example-app/installations/new?state=..."
}
```

### Error Responses

Status: `500 Internal Server Error`

```json
{
  "error": "Failed to create install URL"
}
```

---

## GitHub App Callback

### Endpoint

```http
GET /api/integrations/github/app/callback
```

### Description

Handles the redirect from GitHub after an app installation. Successful installations redirect to the frontend with an `install=ok` parameter. Failed installations redirect with an `install=error` parameter and an explanatory `reason`.

### Query Parameters

- `installation_id`: The ID of the GitHub App installation.
- `setup_action`: The action being performed (e.g., `install`, `update`).
- `state`: The signed state parameter used to verify the request and prevent CSRF.

### Validation Errors

Redirects with `install=error` and one of the following `reason` values:
- `missing_installation_id`: The installation ID was missing or invalid.
- `bad_payload`: The payload inside the state parameter was malformed.
- `expired_state`: The state parameter was generated more than 15 minutes ago.
- Other verification or callback errors.

---

## GitHub App Sync

### Endpoint

```http
POST /api/integrations/github/app/sync
```

### Description

Syncs GitHub repositories for a GitHub App installation.

### Authentication

Required

### Request Body

```json
{
  "installationId": 123456
}
```
*Note: `installationId` is optional. If omitted, the server will sync all stored installation IDs for the user.*

### Success Response

Status: `200 OK`

```json
{
  "ok": true,
  "installationIds": [123456],
  "results": [
    {
      "installationId": 123456,
      "reposSeen": 50
    }
  ],
  "reposSeen": 50
}
```

### Error Responses

Status: `400 Bad Request`

```json
{
  "error": "No GitHub App installation found for this user. Install the GitHub App first, then try syncing again."
}
```

Status: `500 Internal Server Error`

```json
{
  "error": "Failed to sync GitHub App installation repos"
}
```

---

## Delete GitHub Integration

### Endpoint

```http
POST /api/integrations/github/app/delete
```

### Description

Deletes the GitHub integration for the authenticated user. It attempts to uninstall the GitHub App from GitHub (best-effort) and cascades deleting pull requests, reviews, connected repositories, and account data from the database.

### Authentication

Required

### Success Response

Status: `200 OK`

```json
{
  "ok": true,
  "deleted": {
    "repos": 5,
    "githubAccount": 1
  },
  "uninstall": [
    {
      "installationId": "123456",
      "ok": true
    }
  ]
}
```

### Error Responses

Status: `500 Internal Server Error`

```json
{
  "error": "Failed to delete GitHub App data"
}
```

---

## Select Repositories

### Endpoint

```http
POST /api/integrations/github/select-repos
```

### Description

Enables specific connected repositories for automation and disables all others for the user.

### Authentication

Required

### Request Body

```json
{
  "repoFullNames": ["owner/repository"]
}
```

### Success Response

Status: `200 OK`

```json
{
  "repos": [
    {
      "id": 1,
      "repoFullName": "owner/repository",
      "enabled": true,
      "installationId": "123456",
      "createdAt": "2026-05-23T10:00:00.000Z",
      "updatedAt": "2026-05-23T10:00:00.000Z"
    }
  ]
}
```

### Error Responses

Status: `400 Bad Request`

```json
{
  "error": "repoFullNames must be a non-empty array"
}
```

Status: `429 Too Many Requests`

```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

Status: `500 Internal Server Error`

```json
{
  "error": "Failed to save selected repos"
}
```

---

## Import Repository

### Endpoint

```http
POST /api/integrations/github/import
```

### Description

Imports a repository via GitHub URL and token. Validates the GitHub URL, fetches the repository details, and creates a local repository record.

### Authentication

Required

### Request Body

```json
{
  "url": "https://github.com/owner/repository",
  "token": "github_token"
}
```

### Success Response

Status: `201 Created`

```json
{
  "repository": {
    "id": 1,
    "name": "repository",
    "url": "https://github.com/owner/repository.git",
    "description": "Repository description",
    "userId": "user-id"
  },
  "source": "github"
}
```

### Error Responses

Status: `400 Bad Request`

```json
{
  "error": "Repository URL is required"
}
```

```json
{
  "error": "GitHub token is required"
}
```

```json
{
  "error": "Invalid GitHub URL"
}
```

Status: `429 Too Many Requests`

```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

Status: `500 Internal Server Error`

```json
{
  "error": "Failed to import from GitHub"
}
```

---

## Connected Repositories

### Endpoint

```http
GET /api/integrations/github/connected-repos
```

### Description

Retrieves the authenticated user's connected GitHub account information and the list of available repositories.

### Authentication

Required

### Success Response

Status: `200 OK`

```json
{
  "account": {
    "id": 1,
    "username": "octocat",
    "githubUserId": "123456",
    "createdAt": "2026-05-23T10:00:00.000Z",
    "updatedAt": "2026-05-23T10:00:00.000Z"
  },
  "repos": [
    {
      "id": 1,
      "repoFullName": "owner/repository",
      "installationId": "123456",
      "enabled": true,
      "createdAt": "2026-05-23T10:00:00.000Z",
      "updatedAt": "2026-05-23T10:00:00.000Z"
    }
  ]
}
```

### Error Responses

Status: `500 Internal Server Error`

```json
{
  "error": "Failed to load connected repos"
}
```

---

## Pull Request Reviews

### Endpoint

```http
GET /api/integrations/github/pr-reviews
```

### Description

Retrieves connected repositories along with their most recent pull requests and their latest reviews.

### Authentication

Required

### Query Parameters

- `repoFullName` (optional): Filter by a specific repository full name.
- `includeDisabled` (optional): Set to `true` to include repositories that have been disabled.
- `limit` (optional): Maximum number of pull requests to return per repository. Default is `20` when omitted or invalid. Values below `1` are clamped to `1`. Values above `100` are clamped to `100`.

### Success Response

Status: `200 OK`

```json
{
  "repos": [
    {
      "id": 1,
      "repoFullName": "owner/repository",
      "enabled": true,
      "installationId": "123456",
      "pullRequests": [
        {
          "id": 100,
          "prNumber": 42,
          "title": "Update documentation",
          "author": "octocat",
          "headSha": "abcdef1234567890",
          "htmlUrl": "https://github.com/owner/repository/pull/42",
          "status": "open",
          "updatedAt": "2026-05-23T10:00:00.000Z",
          "reviews": [
            {
              "id": 200,
              "createdAt": "2026-05-23T11:00:00.000Z",
              "reviewText": "Looks good to me!"
            }
          ]
        }
      ]
    }
  ]
}
```

### Error Responses

Status: `500 Internal Server Error`

```json
{
  "error": "Failed to load PR reviews"
}
```
