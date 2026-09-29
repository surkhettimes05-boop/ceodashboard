# Shared pilot PostgreSQL backup and restore

This is shared operations tooling for PASALO, CEO Dashboard, and Commerce. It
backs up PostgreSQL only. The three named databases are logical databases on
one PostgreSQL server; Redis is a separate, optional shared service and is not
part of the PostgreSQL dump.

## Existing backup hooks found during review

- PASALO's docs describe object storage but the repository had no shared,
  runnable three-database backup/restore utility.
- CEO Dashboard has one-database local/S3 scripts. Its existing restore helper
  drops the named restore-test database before recreating it, and its separate
  cleanup scripts use age-based deletion without verifying each dump. The new
  shared utility does not call or modify those scripts.
- Commerce's `backend/src/database/deployMigrate.ts` writes a local custom
  dump before migrations. That file is a migration rollback aid, not a
  scheduled/offsite backup and has no retention policy. This flow is unchanged.

## What the tool does

`scripts/pilot-db-ops.py` writes PostgreSQL custom-format (`pg_dump -Fc`)
dumps for all three databases, or one selected database. It verifies each dump
with `pg_restore --list`, captures database/table metadata plus exact counts for
recognized migration and representative tables, and stores a SHA-256 manifest. It optionally uploads both
the dump and its JSON manifest to S3-compatible object storage. Files are
written outside the application repositories by default and use owner-only
permissions where supported.

Each file is published from a verified temporary file by atomic rename. If a
dump or upload fails, retention does not run. Any already-published dump is
complete and individually verified; previous backups stay in place. Retention considers only files that pass `pg_restore --list`,
separately per database and tier, and keeps the newest 7 daily, 4 weekly, and 3
monthly valid dumps. Invalid artifacts are kept for investigation. The same
validation is used before deleting remote objects; a dump is never selected for
deletion unless its replacement set includes a newer valid dump.

The tool refuses to overwrite backup files, refuses to restore into a database
that already exists, and has no production restore mode or database-drop path.
A restore-test target must be exactly `pasalo_restore_test`, `ceo_restore_test`,
or `commerce_restore_test`, and the admin service must point to loopback.
Failed restore databases are preserved for diagnosis.

## Requirements and credentials

- Python 3.9 or newer, PostgreSQL client tools (`pg_dump`, `pg_restore`, `psql`,
  `createdb`) compatible with the server version.
- A protected `pg_service.conf` outside the repositories. Use libpq's protected
  `PGPASSFILE` (recommended), the platform's normal PostgreSQL password file,
  or a protected `PGPASSWORD` environment variable. Never put passwords in the
  service file, command line, or repository.
- The backup role needs connection, schema usage, and read access to all
  application tables/sequences in the three logical databases. Do not reuse
  application runtime roles if a dedicated least-privilege backup role is
  available. Restore testing needs a local role allowed to create databases.
- Optional AWS CLI and an S3-compatible bucket. Use an attached workload role
  or named AWS profile where available; do not commit access keys. Configure
  bucket-side versioning/retention/encryption according to the storage provider.
  S3/object-storage upload still requires pilot-host validation: confirm provider
  authentication, upload/download, remote checksum verification, and an isolated
  restore before enabling the scheduled job. Local restore validation does not
  prove offsite recovery.

The current repository examples use different app database names (`ceodashboard`
and `storesync`) and Commerce's active local `.env` points to a managed remote
host. Those application settings are not changed by this tooling. Service
profiles map the stable backup identities `pasalo`, `ceo`, and `commerce` to
the intended database names on the shared pilot server. Review every `dbname`
and host before enabling a scheduled job. Never use the remote Commerce URL for
a local restore test.

Example service file (`%APPDATA%/postgresql/.pg_service.conf` on Windows or a
protected path on Linux):

```ini
[pilot_pasalo]
host=127.0.0.1
port=5432
dbname=pasalo
user=pilot_backup
sslmode=prefer

[pilot_ceo]
host=127.0.0.1
port=5432
dbname=ceo
user=pilot_backup
sslmode=prefer

[pilot_commerce]
host=127.0.0.1
port=5432
dbname=commerce
user=pilot_backup
sslmode=prefer

[pilot_restore_local]
host=127.0.0.1
port=5432
dbname=postgres
user=pilot_restore
```

All three backup profiles must use the same host and port and three distinct
database names. For remote pilot backups set the actual approved PostgreSQL
host and TLS verification settings. Keep the restore profile on loopback.
Store matching credentials in the protected PostgreSQL password file; use `*`
for the database field only if the backup account is shared across the three
logical databases.

## Configure and run

Set these environment variables in the scheduled job's protected environment:

```text
PILOT_PG_SERVICE_FILE=<protected pg_service.conf path>
PILOT_BACKUP_DIR=<protected directory outside the repositories>
PGPASSFILE=<protected PostgreSQL password file>     # or use the platform default
PILOT_S3_BUCKET=<bucket name>                       # optional; enables offsite upload
PILOT_S3_PREFIX=pilot-postgresql                    # optional; default shown
PILOT_S3_REGION=<provider region>                    # optional
PILOT_S3_ENDPOINT_URL=<S3-compatible endpoint>       # optional, e.g. Spaces
PILOT_S3_SSE=AES256                                  # optional; set empty if unsupported
```

Run from the CEO Dashboard repository root:

```bash
python scripts/pilot-db-ops.py backup --tier daily
python scripts/pilot-db-ops.py backup --tier weekly
python scripts/pilot-db-ops.py backup --tier monthly
```

`backup` defaults to all three databases. Add `--database pasalo`, `--database
ceo`, or `--database commerce` to back up just one. For object storage, the AWS
CLI's configured profile/role supplies authentication.

## Restore test and verification

Use a local PostgreSQL instance only. Set `PILOT_PG_ADMIN_SERVICE=pilot_restore_local`
in the protected environment and keep the service on `127.0.0.1`, `::1`, or
`localhost`. The command checks the target name and confirms the database does
not already exist before creating anything. It never drops or overwrites a
database.

```bash
python scripts/pilot-db-ops.py restore-test \
  --database pasalo \
  --backup "$PILOT_BACKUP_DIR/pasalo_daily_<UTC timestamp>.dump" \
  --target-db pasalo_restore_test
```

Repeat for `ceo` and `commerce`, with their matching dump and target database.
The restore uses `pg_restore --exit-on-error --no-owner --no-privileges`, then
checks that user tables exist, a recognized Prisma or SQL migration ledger has
applied records, and prints exact row counts for migration tables and any
present representative business tables (`users`, `organizations`, `stores`,
`products`, `invoices`, `orders`, `sales`, `purchase_orders`, `customers`, and
`inventory_items`). It checks the dump checksum against its manifest and reports migration and
representative row counts from the restored database. Count differences from a
pre-dump manifest are reported as warnings because live writes can occur
between metadata capture and the dump snapshot; set `PILOT_STRICT_RESTORE_COUNTS=1`
only when the source is known to be quiescent. Review the manifest and
verification output and record the dump
name, restore target, timestamp, table counts, migration counts, and result.
Do not remove restore-test databases as part of scheduled backup retention.

If a target database already exists, stop and inspect it; the tool will not
replace it. To repeat a restore test, use an approved local cleanup procedure
after confirming the database is a disposable restore-test database.

## Pilot schedule proposal

After local validation succeeds, install these jobs in the pilot host's
scheduler (UTC), with the protected environment above. This document does not
install or activate jobs:

| Tier | Schedule | Retention |
|---|---|---:|
| Daily | Every day at 02:00 UTC | 7 valid dumps per database |
| Weekly | Sunday at 03:00 UTC | 4 valid dumps per database |
| Monthly | First day of each month at 04:00 UTC | 3 valid dumps per database |

Linux cron examples:

```cron
0 2 * * * cd /opt/ceodashboard && python scripts/pilot-db-ops.py backup --tier daily
0 3 * * 0 cd /opt/ceodashboard && python scripts/pilot-db-ops.py backup --tier weekly
0 4 1 * * cd /opt/ceodashboard && python scripts/pilot-db-ops.py backup --tier monthly
```

Route stdout/stderr to the pilot's monitored job log and alert on any nonzero
exit. Confirm offsite uploads, object versioning, permissions, and the actual
service profile targets before activating these entries.

## Redis authority and recovery

PostgreSQL remains authoritative for business records. Repository code shows
PASALO's Redis use as best-effort session caching with database fallback, CEO
Dashboard currently uses in-process rate limiting, and Commerce uses Redis for
cache and observability. None of those Redis uses is the source
of truth for orders, inventory, invoices, or accounting records. Redis may be
shared as an ephemeral service; no cross-database Redis dump is included.
If future pilot code stores durable queue state or business data in Redis,
reassess persistence and recovery before rollout. Redis RDB/AOF persistence is
an operational durability option, not a replacement for PostgreSQL backups.
