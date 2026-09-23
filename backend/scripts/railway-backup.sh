#!/usr/bin/env bash

set -Eeuo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${S3_BUCKET:?S3_BUCKET is required}"
: "${AWS_REGION:?AWS_REGION is required}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID is required}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY is required}"

command -v pg_dump >/dev/null 2>&1 || { echo "ERROR: pg_dump is required" >&2; exit 1; }
command -v pg_restore >/dev/null 2>&1 || { echo "ERROR: pg_restore is required" >&2; exit 1; }
command -v aws >/dev/null 2>&1 || { echo "ERROR: AWS CLI is required" >&2; exit 1; }

BACKUP_TYPE="${1:-daily}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
S3_PREFIX="${S3_PREFIX:-ceodashboard}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="ceodashboard_${BACKUP_TYPE}_${TIMESTAMP}.dump"
BACKUP_PATH="/tmp/${BACKUP_FILE}"
LOCK_DIR="/tmp/ceodashboard-backup.lock"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "ERROR: another backup is already running in this container" >&2
  exit 2
fi

cleanup() {
  rm -f "$BACKUP_PATH"
  rmdir "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT

pg_dump --format=custom --file="$BACKUP_PATH" "$DATABASE_URL"
pg_restore --list "$BACKUP_PATH" >/dev/null
aws s3 cp "$BACKUP_PATH" "s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_FILE}" --region "$AWS_REGION"

mapfile -t OLD_KEYS < <(
  aws s3api list-objects-v2 \
    --bucket "$S3_BUCKET" \
    --prefix "${S3_PREFIX}/ceodashboard_${BACKUP_TYPE}_" \
    --query "sort_by(Contents, &LastModified)[0:-${RETENTION_DAYS}].Key" \
    --output text \
    --region "$AWS_REGION" | tr '\t' '\n' | sed '/^None$/d;/^$/d'
)

for key in "${OLD_KEYS[@]}"; do
  aws s3api delete-object --bucket "$S3_BUCKET" --key "$key" --region "$AWS_REGION"
done

echo "Backup uploaded: s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_FILE}"
echo "Retention applied: ${RETENTION_DAYS} ${BACKUP_TYPE} backups"
