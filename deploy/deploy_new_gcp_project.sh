#!/usr/bin/env bash
set -euo pipefail

# Deploy GitVerse (web + worker) to a NEW Google Cloud project.
#
# Requirements:
# - gcloud installed + authenticated to the target Google Cloud ACCOUNT
# - Billing enabled for the project (either pre-linked, or provide BILLING_ACCOUNT_ID)
# - You provide required secrets via environment variables (see REQUIRED SECRETS below)
#
# Usage:
#   export NEW_PROJECT_ID="my-new-project-123"
#   export REGION="asia-southeast1"
#   export ARTIFACT_REPO="gitverse"
#   export IMAGE_NAME="gitverse-nextjs"
#
#   # Required secrets (see list below)
#   export DATABASE_URL='...'
#   export GEMINI_API_KEY='...'
#   export JWT_SECRET='...'
#   export NEXTAUTH_URL='https://<your-cloud-run-or-custom-domain>'
#   export NEXTAUTH_SECRET='...'
#   export GOOGLE_CLIENT_ID='...'
#   export GOOGLE_CLIENT_SECRET='...'
#
#   # Required GitHub App config
#   export GITHUB_APP_ID='123456'
#   export GITHUB_APP_PRIVATE_KEY='-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----'
#   export GITHUB_APP_SLUG='your-github-app-slug'
#   export GITHUB_WEBHOOK_SECRET='...'
#
#   # Optional (defaults to NEXTAUTH_SECRET)
#   export GITHUB_APP_STATE_SECRET='...'
#   export NEXT_PUBLIC_FIREBASE_API_KEY='...'
#
#   # Optional: only if the project has no billing linked yet
#   export BILLING_ACCOUNT_ID='XXXXXX-XXXXXX-XXXXXX'
#
#   ./deploy/deploy_new_gcp_project.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR"

NEW_PROJECT_ID="${NEW_PROJECT_ID:-}"
REGION="${REGION:-asia-southeast1}"
ARTIFACT_REPO="${ARTIFACT_REPO:-gitverse}"
IMAGE_NAME="${IMAGE_NAME:-gitverse-nextjs}"

# Optional: load required secrets from a local env file (recommended to avoid exporting secrets
# in your shell history). Values already set in the environment take precedence.
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"

SERVICE_WEB="${SERVICE_WEB:-gitverse-nextjs-cr}"
SERVICE_WORKER="${SERVICE_WORKER:-gitverse-worker}"

# Optional
BILLING_ACCOUNT_ID="${BILLING_ACCOUNT_ID:-}"
SKIP_BUILD="${SKIP_BUILD:-0}"

# Tuning knobs (Cloud Run)
# Defaults are chosen to improve analysis performance over the smallest settings.
WEB_CPU="${WEB_CPU:-1}"
WEB_MEMORY="${WEB_MEMORY:-1Gi}"
WEB_CONCURRENCY="${WEB_CONCURRENCY:-40}"
WEB_TIMEOUT="${WEB_TIMEOUT:-600}"

WORKER_CPU="${WORKER_CPU:-2}"
WORKER_MEMORY="${WORKER_MEMORY:-2Gi}"
WORKER_CONCURRENCY="${WORKER_CONCURRENCY:-10}"
WORKER_TIMEOUT="${WORKER_TIMEOUT:-1800}"

# Options: "throttling" (default Cloud Run behavior) or "no-throttling".
WEB_CPU_THROTTLING="${WEB_CPU_THROTTLING:-throttling}"
WORKER_CPU_THROTTLING="${WORKER_CPU_THROTTLING:-no-throttling}"

load_dotenv() {
  local file="$1"
  [[ -f "$file" ]] || return 0

  # Parse KEY=VALUE lines without executing anything.
  # - Ignores comments/blank lines
  # - Supports optional leading `export `
  # - Preserves everything after the first '=' (e.g., URLs containing '&')
  # - Strips matching single/double quotes around the whole value
  # - Does not override already-set environment variables
  local multiline_key=""
  local multiline_value=""
  local multiline_quote=""

  while IFS= read -r line || [[ -n "$line" ]]; do
    local line_raw="$line"

    # trim leading/trailing whitespace
    line="${line#${line%%[![:space:]]*}}"
    line="${line%${line##*[![:space:]]}}"

    # If we're currently capturing a multi-line value (e.g., PEM), append raw line and
    # finish when we hit the END marker.
    if [[ -n "$multiline_key" ]]; then
      # Skip mode: consume lines until END marker
      if [[ "$multiline_key" == "__SKIP__" ]]; then
        if [[ "$line_raw" == "-----END "* ]]; then
          multiline_key=""
          multiline_value=""
          multiline_quote=""
        fi
        continue
      fi

      local line_to_add="$line_raw"
      if [[ -n "$multiline_quote" && "$line_raw" == "-----END "* ]]; then
        # Common pattern: the closing quote is appended to the END line.
        local last_char="${line_to_add: -1}"
        if [[ "$last_char" == "$multiline_quote" ]]; then
          line_to_add="${line_to_add:0:${#line_to_add}-1}"
        fi
      fi

      multiline_value+=$'\n'"$line_to_add"
      if [[ "$line_raw" == "-----END "* ]]; then
        export "$multiline_key=$multiline_value"
        multiline_key=""
        multiline_value=""
        multiline_quote=""
      fi
      continue
    fi

    [[ -z "$line" ]] && continue
    [[ "$line" == \#* ]] && continue

    if [[ "$line" == export\ * ]]; then
      line="${line#export }"
      line="${line#${line%%[![:space:]]*}}"
    fi

    [[ "$line" != *"="* ]] && continue

    local key="${line%%=*}"
    local value="${line#*=}"

    # trim key/value whitespace
    key="${key#${key%%[![:space:]]*}}"
    key="${key%${key##*[![:space:]]}}"
    value="${value#${value%%[![:space:]]*}}"
    value="${value%${value##*[![:space:]]}}"

    # Only accept valid shell identifier keys. This prevents PEM/base64 lines
    # (which often contain '=') from being mis-parsed as env assignments.
    if [[ ! "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      continue
    fi

    # Strip surrounding quotes (only if they match and cover the entire value)
    if [[ ${#value} -ge 2 ]]; then
      if [[ "${value:0:1}" == '"' && "${value: -1}" == '"' ]]; then
        value="${value:1:${#value}-2}"
      elif [[ "${value:0:1}" == "'" && "${value: -1}" == "'" ]]; then
        value="${value:1:${#value}-2}"
      fi
    fi

    # Support multi-line PEM keys in .env (common when copy/pasting GitHub App private keys).
    # We capture until the END marker and then export the full value (with newlines).
    # Accept an optional opening quote before the BEGIN line.
    local value_for_check="$value"
    local quote_for_check=""
    if [[ "$value_for_check" == '"'* ]]; then
      quote_for_check='"'
      value_for_check="${value_for_check#\"}"
    elif [[ "$value_for_check" == "'"* ]]; then
      quote_for_check="'"
      value_for_check="${value_for_check#\'}"
    fi

    if [[ "$key" == "GITHUB_APP_PRIVATE_KEY" && "$value_for_check" == "-----BEGIN "* && "$value_for_check" != *"-----END "* ]]; then
      if [[ -z "${!key:-}" ]]; then
        multiline_key="$key"
        multiline_quote="$quote_for_check"
        multiline_value="$value_for_check"
      else
        multiline_key="__SKIP__"
        multiline_value=""
        multiline_quote=""
      fi
      continue
    fi

    if [[ -z "${!key:-}" ]]; then
      export "$key=$value"
    fi
  done < "$file"
}

# ---- Required secrets (values must be set in environment) ----
: "${NEW_PROJECT_ID:?Must set NEW_PROJECT_ID}"

if [[ -f "$ENV_FILE" ]]; then
  echo "==> Loading env from: $ENV_FILE"
  load_dotenv "$ENV_FILE"
else
  echo "==> ENV_FILE not found ($ENV_FILE); relying on exported environment variables"
fi

: "${DATABASE_URL:?Must set DATABASE_URL}"
: "${GEMINI_API_KEY:?Must set GEMINI_API_KEY}"
: "${JWT_SECRET:?Must set JWT_SECRET}"
: "${NEXTAUTH_SECRET:?Must set NEXTAUTH_SECRET}"
: "${GOOGLE_CLIENT_ID:?Must set GOOGLE_CLIENT_ID}"
: "${GOOGLE_CLIENT_SECRET:?Must set GOOGLE_CLIENT_SECRET}"
: "${GITHUB_APP_ID:?Must set GITHUB_APP_ID}"
: "${GITHUB_APP_PRIVATE_KEY:?Must set GITHUB_APP_PRIVATE_KEY}"
: "${GITHUB_APP_SLUG:?Must set GITHUB_APP_SLUG}"
: "${GITHUB_WEBHOOK_SECRET:?Must set GITHUB_WEBHOOK_SECRET}"

# Optional (defaults to NEXTAUTH_SECRET in app code)
GITHUB_APP_STATE_SECRET="${GITHUB_APP_STATE_SECRET:-}"

# Optional (not currently used by the Cloud Run deploy path / app code)
NEXT_PUBLIC_FIREBASE_API_KEY="${NEXT_PUBLIC_FIREBASE_API_KEY:-}"

# NEXTAUTH_URL can be derived after the first Cloud Run deployment, so we allow it to be
# omitted up-front.
NEXTAUTH_URL="${NEXTAUTH_URL:-}"
if [[ -z "$NEXTAUTH_URL" ]]; then
  NEXTAUTH_URL="https://placeholder.invalid"
  echo "==> NEXTAUTH_URL not set; will auto-update after deploy"
fi

is_localhost_url() {
  local v="$1"
  [[ -z "$v" ]] && return 1
  [[ "$v" == http://localhost* ]] && return 0
  [[ "$v" == https://localhost* ]] && return 0
  [[ "$v" == http://127.0.0.1* ]] && return 0
  [[ "$v" == https://127.0.0.1* ]] && return 0
  return 1
}

is_placeholder_value() {
  local v="$1"
  local v_lc
  v_lc="${v,,}"

  [[ -z "$v" ]] && return 0
  [[ "$v_lc" == *"your_"* ]] && return 0
  [[ "$v_lc" == *"your-"* ]] && return 0
  [[ "$v_lc" == *"changeme"* ]] && return 0
  [[ "$v_lc" == *"replace"* ]] && return 0
  [[ "$v_lc" == *"placeholder"* ]] && return 0
  return 1
}

assert_not_placeholder() {
  local name="$1"
  local value="$2"
  if is_placeholder_value "$value"; then
    echo "ERROR: $name looks like a placeholder. Set a real secret value before deploying." >&2
    exit 1
  fi
}

assert_not_placeholder NEXTAUTH_SECRET "$NEXTAUTH_SECRET"
assert_not_placeholder JWT_SECRET "$JWT_SECRET"
assert_not_placeholder GOOGLE_CLIENT_SECRET "$GOOGLE_CLIENT_SECRET"

if [[ "${VALIDATE_ONLY:-}" == "1" ]]; then
  echo "==> Validation OK (VALIDATE_ONLY=1)"
  exit 0
fi

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

need_cmd gcloud

echo "==> Using workspace: $APP_DIR"
cd "$APP_DIR"

echo "==> Ensuring gcloud is logged in"
gcloud auth list --filter=status:ACTIVE --format='value(account)' >/dev/null

echo "==> Creating/using project: $NEW_PROJECT_ID"
if ! gcloud projects describe "$NEW_PROJECT_ID" >/dev/null 2>&1; then
  echo "Project does not exist; creating..."
  gcloud projects create "$NEW_PROJECT_ID" --quiet
fi

gcloud config set project "$NEW_PROJECT_ID" >/dev/null

echo "==> Ensuring billing is enabled"
# This will error if billing is not linked. If BILLING_ACCOUNT_ID provided, attempt to link.
if ! gcloud beta billing projects describe "$NEW_PROJECT_ID" --format='value(billingEnabled)' 2>/dev/null | tr '[:upper:]' '[:lower:]' | grep -q true; then
  if [[ -z "$BILLING_ACCOUNT_ID" ]]; then
    echo "Billing is not enabled for $NEW_PROJECT_ID." >&2
    echo "Provide BILLING_ACCOUNT_ID or link billing manually in Cloud Console." >&2
    exit 1
  fi

  echo "Linking billing account $BILLING_ACCOUNT_ID ..."
  gcloud beta billing projects link "$NEW_PROJECT_ID" --billing-account="$BILLING_ACCOUNT_ID" --quiet
fi

echo "==> Enabling required APIs"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  --quiet

echo "==> Creating Artifact Registry repo (if needed): $ARTIFACT_REPO ($REGION)"
if ! gcloud artifacts repositories describe "$ARTIFACT_REPO" --location="$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$ARTIFACT_REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Docker images for GitVerse" \
    --quiet
fi

echo "==> Creating runtime service account"
RUNTIME_SA_NAME="gitverse-runtime"
RUNTIME_SA_EMAIL="$RUNTIME_SA_NAME@$NEW_PROJECT_ID.iam.gserviceaccount.com"
if ! gcloud iam service-accounts describe "$RUNTIME_SA_EMAIL" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$RUNTIME_SA_NAME" \
    --display-name="GitVerse Cloud Run runtime" \
    --quiet
fi

# Allow Cloud Run to read secrets.
# Note: granting at project level is simplest; you can tighten later.
echo "==> Granting Secret Manager access to runtime service account"
gcloud projects add-iam-policy-binding "$NEW_PROJECT_ID" \
  --member="serviceAccount:$RUNTIME_SA_EMAIL" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet

# ---- Secrets ----
# We create one secret per env var name for clarity.
# (You can rename later; but keeping 1:1 makes deploy scripts simple.)
ensure_secret() {
  local secret_name="$1"
  local secret_value="$2"

  if ! gcloud secrets describe "$secret_name" >/dev/null 2>&1; then
    gcloud secrets create "$secret_name" --replication-policy="automatic" --quiet
  fi

  # Always add a new version (safe; keeps history)
  printf '%s' "$secret_value" | gcloud secrets versions add "$secret_name" --data-file=- --quiet
}

ensure_secret_if_set() {
  local secret_name="$1"
  local secret_value="$2"

  if [[ -n "$secret_value" ]]; then
    ensure_secret "$secret_name" "$secret_value"
  else
    echo "==> Skipping optional secret (unset): $secret_name"
  fi
}

echo "==> Creating/updating secrets"
ensure_secret DATABASE_URL "$DATABASE_URL"
ensure_secret GEMINI_API_KEY "$GEMINI_API_KEY"
ensure_secret JWT_SECRET "$JWT_SECRET"
ensure_secret NEXTAUTH_URL "$NEXTAUTH_URL"
ensure_secret NEXTAUTH_SECRET "$NEXTAUTH_SECRET"
ensure_secret GOOGLE_CLIENT_ID "$GOOGLE_CLIENT_ID"
ensure_secret GOOGLE_CLIENT_SECRET "$GOOGLE_CLIENT_SECRET"
ensure_secret GITHUB_APP_ID "$GITHUB_APP_ID"
ensure_secret GITHUB_APP_PRIVATE_KEY "$GITHUB_APP_PRIVATE_KEY"
ensure_secret GITHUB_APP_SLUG "$GITHUB_APP_SLUG"
ensure_secret GITHUB_WEBHOOK_SECRET "$GITHUB_WEBHOOK_SECRET"
ensure_secret_if_set GITHUB_APP_STATE_SECRET "$GITHUB_APP_STATE_SECRET"
ensure_secret_if_set NEXT_PUBLIC_FIREBASE_API_KEY "$NEXT_PUBLIC_FIREBASE_API_KEY"

# ---- Build image ----
IMAGE_URI="$REGION-docker.pkg.dev/$NEW_PROJECT_ID/$ARTIFACT_REPO/$IMAGE_NAME:latest"

if [[ "$SKIP_BUILD" == "1" ]]; then
  echo "==> SKIP_BUILD=1; reusing existing image: $IMAGE_URI"
else
  echo "==> Building & pushing image with Cloud Build: $IMAGE_URI"
  gcloud builds submit --tag "$IMAGE_URI" .
fi

# ---- Deploy web service ----
echo "==> Deploying web service: $SERVICE_WEB"
ENV_VARS_COMMON="PRISMA_ADAPTER=pg,PG_POOL_MAX=2,PG_POOL_CONNECTION_TIMEOUT_MS=30000"
BASE_SET_SECRETS="DATABASE_URL=DATABASE_URL:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,JWT_SECRET=JWT_SECRET:latest,NEXTAUTH_URL=NEXTAUTH_URL:latest,NEXTAUTH_SECRET=NEXTAUTH_SECRET:latest,GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest,GITHUB_APP_ID=GITHUB_APP_ID:latest,GITHUB_APP_PRIVATE_KEY=GITHUB_APP_PRIVATE_KEY:latest,GITHUB_APP_SLUG=GITHUB_APP_SLUG:latest,GITHUB_WEBHOOK_SECRET=GITHUB_WEBHOOK_SECRET:latest"
WEB_SET_SECRETS="$BASE_SET_SECRETS"
if gcloud secrets describe GITHUB_APP_STATE_SECRET >/dev/null 2>&1; then
  WEB_SET_SECRETS="$WEB_SET_SECRETS,GITHUB_APP_STATE_SECRET=GITHUB_APP_STATE_SECRET:latest"
fi
if gcloud secrets describe NEXT_PUBLIC_FIREBASE_API_KEY >/dev/null 2>&1; then
  WEB_SET_SECRETS="$WEB_SET_SECRETS,NEXT_PUBLIC_FIREBASE_API_KEY=NEXT_PUBLIC_FIREBASE_API_KEY:latest"
fi

WEB_CPU_THROTTLING_FLAG="--cpu-throttling"
if [[ "$WEB_CPU_THROTTLING" == "no-throttling" ]]; then
  WEB_CPU_THROTTLING_FLAG="--no-cpu-throttling"
fi

gcloud run deploy "$SERVICE_WEB" \
  --region "$REGION" \
  --image "$IMAGE_URI" \
  --service-account "$RUNTIME_SA_EMAIL" \
  --allow-unauthenticated \
  --cpu "$WEB_CPU" \
  --memory "$WEB_MEMORY" \
  --concurrency "$WEB_CONCURRENCY" \
  --timeout "$WEB_TIMEOUT" \
  $WEB_CPU_THROTTLING_FLAG \
  --set-secrets "$WEB_SET_SECRETS" \
  --set-env-vars "$ENV_VARS_COMMON" \
  --quiet

WEB_URL="$(gcloud run services describe "$SERVICE_WEB" --region "$REGION" --format='value(status.url)')"

# Cloud Run can expose multiple URLs for a service (see annotation run.googleapis.com/urls).
# Prefer the regional *project-number* URL (e.g. https://service-1234567890.region.run.app) so
# NEXTAUTH_URL is stable and consistent with OAuth / GitHub App setup URLs.
WEB_URLS_RAW="$(gcloud run services describe "$SERVICE_WEB" --region "$REGION" --format='value(metadata.annotations."run.googleapis.com/urls")' 2>/dev/null || true)"
WEB_URL_PREFERRED="$(printf '%s' "$WEB_URLS_RAW" | tr -d '[]"' | tr ',' '\n' | sed 's/^ *//;s/ *$//' | grep -E "^https://.+-[0-9]+\\.${REGION}\\.run\\.app$" | head -n 1)"
if [[ -n "$WEB_URL_PREFERRED" ]]; then
  WEB_URL="$WEB_URL_PREFERRED"
fi

# If we started with a placeholder (or accidentally used localhost from a dev .env),
# update NEXTAUTH_URL to the real Cloud Run URL and redeploy web (and worker for consistency).
if [[ "$NEXTAUTH_URL" == "https://placeholder.invalid" ]] || is_localhost_url "$NEXTAUTH_URL"; then
  echo "==> Updating NEXTAUTH_URL secret to: $WEB_URL"
  ensure_secret NEXTAUTH_URL "$WEB_URL"

  echo "==> Redeploying web service to pick up updated NEXTAUTH_URL"
  WEB_SET_SECRETS="$BASE_SET_SECRETS"
  if gcloud secrets describe GITHUB_APP_STATE_SECRET >/dev/null 2>&1; then
    WEB_SET_SECRETS="$WEB_SET_SECRETS,GITHUB_APP_STATE_SECRET=GITHUB_APP_STATE_SECRET:latest"
  fi
  if gcloud secrets describe NEXT_PUBLIC_FIREBASE_API_KEY >/dev/null 2>&1; then
    WEB_SET_SECRETS="$WEB_SET_SECRETS,NEXT_PUBLIC_FIREBASE_API_KEY=NEXT_PUBLIC_FIREBASE_API_KEY:latest"
  fi

  gcloud run deploy "$SERVICE_WEB" \
    --region "$REGION" \
    --image "$IMAGE_URI" \
    --service-account "$RUNTIME_SA_EMAIL" \
    --allow-unauthenticated \
    --cpu "$WEB_CPU" \
    --memory "$WEB_MEMORY" \
    --concurrency "$WEB_CONCURRENCY" \
    --timeout "$WEB_TIMEOUT" \
    $WEB_CPU_THROTTLING_FLAG \
    --set-secrets "$WEB_SET_SECRETS" \
    --set-env-vars "$ENV_VARS_COMMON" \
    --quiet
fi

echo "==> Deploying worker service: $SERVICE_WORKER"
# Worker needs to stay alive to poll the DB; keep min instances at 1.
# Uses the same image but overrides the command to run the worker health server + loop.
WORKER_SET_SECRETS="$BASE_SET_SECRETS"
if gcloud secrets describe GITHUB_APP_STATE_SECRET >/dev/null 2>&1; then
  WORKER_SET_SECRETS="$WORKER_SET_SECRETS,GITHUB_APP_STATE_SECRET=GITHUB_APP_STATE_SECRET:latest"
fi
if gcloud secrets describe NEXT_PUBLIC_FIREBASE_API_KEY >/dev/null 2>&1; then
  WORKER_SET_SECRETS="$WORKER_SET_SECRETS,NEXT_PUBLIC_FIREBASE_API_KEY=NEXT_PUBLIC_FIREBASE_API_KEY:latest"
fi

WORKER_CPU_THROTTLING_FLAG="--cpu-throttling"
if [[ "$WORKER_CPU_THROTTLING" == "no-throttling" ]]; then
  WORKER_CPU_THROTTLING_FLAG="--no-cpu-throttling"
fi

gcloud run deploy "$SERVICE_WORKER" \
  --region "$REGION" \
  --image "$IMAGE_URI" \
  --service-account "$RUNTIME_SA_EMAIL" \
  --no-allow-unauthenticated \
  --min-instances 1 \
  --cpu "$WORKER_CPU" \
  --memory "$WORKER_MEMORY" \
  --concurrency "$WORKER_CONCURRENCY" \
  --timeout "$WORKER_TIMEOUT" \
  $WORKER_CPU_THROTTLING_FLAG \
  --command "node" \
  --args "dist-worker/scripts/workerServer.js" \
  --set-secrets "$WORKER_SET_SECRETS" \
  --set-env-vars "$ENV_VARS_COMMON" \
  --quiet

WORKER_URL="$(gcloud run services describe "$SERVICE_WORKER" --region "$REGION" --format='value(status.url)')"

cat <<EOF

✅ Deployment complete

Web service:
  $SERVICE_WEB
  $WEB_URL

Worker service:
  $SERVICE_WORKER
  $WORKER_URL

Next steps:
- Update Google OAuth redirect URIs to include:
  ${WEB_URL}/api/auth/callback/google
  (and your custom domain if you add one)
- Update NEXTAUTH_URL secret to match your final public domain.
EOF
