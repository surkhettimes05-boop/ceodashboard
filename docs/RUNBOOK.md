# Operations Runbook

## Deployment

1. Copy backend/.env.example to backend/.env and fill in production values.
2. Ensure NODE_ENV=production and same secrets are used across all instances.
3. Run Prisma migrations in the target environment: `npx prisma migrate deploy`.
4. Run the seed only when an explicit bootstrap is required: `SEED_CEO_EMAIL` and `SEED_CEO_PASSWORD` must be set.
5. Start backend and frontend behind a TLS-enabled reverse proxy.

## Rollback

1. Stop the new release.
2. Restore the last known good database backup.
3. Redeploy the previous container image or build artifact.
4. Confirm the health endpoint and ready endpoint return expected values.

## Secret rotation

1. Rotate JWT_SECRET and JWT_REFRESH_SECRET immediately if either is exposed.
2. Rotate any production password that was created from a starter seed or default value.
3. Update the deployment environment variables before restarting services.

## Restore backup

1. Restore the database to a scratch instance.
2. Validate the ledger totals and stock reconciliations.
3. Re-run the application smoke checks.

## Daily checks

- Trial balance totals match the ledger.
- Stock reconciliation matches inventory movement totals.
- Last backup completed successfully.
- Authentication and authorization logs show no suspicious failed-login bursts.
- CEO and ADMIN access remains limited to approved users only.
