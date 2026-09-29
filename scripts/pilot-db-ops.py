import argparse
import configparser
import datetime as dt
import json
import hashlib
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

DATABASES = ("pasalo", "ceo", "commerce")
TIERS = {"daily": 7, "weekly": 4, "monthly": 3}
SERVICE_PREFIX = "pilot_"
STAMP_RE = re.compile(r"_(\d{8}T\d{6}Z)\.dump$")
def fail(message):
    raise RuntimeError(message)


def run(args, *, env=None, capture=False):
    result = subprocess.run(
        [str(part) for part in args],
        check=False,
        text=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
        env=env,
    )
    if result.returncode:
        # Never echo command arguments or connection strings; PostgreSQL tools may
        # include host details in errors, but credentials stay in libpq auth files.
        detail = " ".join((result.stderr or "").strip().splitlines()[-2:])
        fail(f"Command failed ({Path(args[0]).name}, exit {result.returncode}); {detail[:400]}")
    return result.stdout.strip() if capture else ""


def service_config():
    path = os.environ.get("PILOT_PG_SERVICE_FILE") or os.environ.get("PGSERVICEFILE")
    if not path:
        fail("Set PILOT_PG_SERVICE_FILE to a protected PostgreSQL service file outside the repository.")
    cfg = configparser.ConfigParser(interpolation=None, strict=True)
    try:
        if not cfg.read(path):
            fail("Cannot read the configured PostgreSQL service file.")
    except configparser.Error as exc:
        fail(f"Invalid PostgreSQL service file: {exc}")
    services = {}
    for name in DATABASES:
        section = SERVICE_PREFIX + name
        if section not in cfg:
            fail(f"Missing PostgreSQL service section [{section}].")
        item = cfg[section]
        if "password" in item:
            fail(f"Do not store a password in [{section}]; use PGPASSFILE or a protected PGPASSWORD environment variable.")
        host, port, dbname = item.get("host"), item.get("port", "5432"), item.get("dbname")
        if not host or not dbname:
            fail(f"[{section}] must define host and dbname.")
        services[name] = {"host": host.lower(), "port": port, "dbname": dbname}
    endpoints = {(entry["host"], entry["port"]) for entry in services.values()}
    if len(endpoints) != 1:
        fail("The three database services must point to the same PostgreSQL host and port.")
    if len({entry["dbname"] for entry in services.values()}) != len(DATABASES):
        fail("The three logical services must map to three distinct PostgreSQL databases.")
    protected_path = Path(path).expanduser().resolve()
    workspace = Path(__file__).resolve().parents[2]
    repo_roots = [workspace / name for name in ("pasalo.os", "ceodashboard", "modern trade website")]
    if any(protected_path == root or root in protected_path.parents for root in repo_roots):
        fail("Keep PostgreSQL service configuration outside all three application repositories.")
    passfile = os.environ.get("PGPASSFILE")
    if passfile:
        pass_path = Path(passfile).expanduser().resolve()
        if any(pass_path == root or root in pass_path.parents for root in repo_roots):
            fail("Keep the PostgreSQL password file outside all three application repositories.")
    return services


def db_env(name):
    env = os.environ.copy()
    service_file = env.get("PILOT_PG_SERVICE_FILE")
    if service_file:
        env["PGSERVICEFILE"] = service_file
    env["PGSERVICE"] = SERVICE_PREFIX + name
    env.pop("PGDATABASE", None)
    return env


def psql(name, sql):
    return run(["psql", "--no-password", "--no-psqlrc", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1", "--command", sql], env=db_env(name), capture=True)


def table_stats(name):
    sql = """SELECT json_build_object(
      'database', current_database(),
      'tables', (SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') AND table_type='BASE TABLE'),
      'migrations', COALESCE((SELECT json_agg(json_build_object('table', table_name, 'rows', row_count)) FROM (
        SELECT table_name, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint AS row_count
        FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('_prisma_migrations','schema_migrations','prisma_migrations')
      ) m), '[]'::json),
      'representative', COALESCE((SELECT json_agg(json_build_object('table', table_name, 'rows', row_count)) FROM (
        SELECT table_name, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint AS row_count
        FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['users','User','organizations','Organization','stores','Store','branches','Branch','products','Product','ProductUnit','customers','Customer','invoices','Invoice','InvoiceItem','orders','Order','sales','purchase_orders','purchase_items','inventory_transactions','inventory_items','InventoryItem','GoodsReceipt','GoodsReceiptItem','ledger_entries','journal_entries','accounts','batch_inventory'])
      ) r), '[]'::json)
    )::text"""
    raw = psql(name, sql)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        fail(f"Could not read verification metadata for database {name}.")


def verify_backup(path):
    run(["pg_restore", "--list", path], capture=True)


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def timestamp(path):
    match = STAMP_RE.search(Path(path).name)
    return match.group(1) if match else ""


def backup(args):
    if args.tier not in TIERS:
        fail("Tier must be daily, weekly, or monthly.")
    default_root = Path(os.environ.get("LOCALAPPDATA") or Path.home() / ".local" / "state")
    backup_dir = Path(os.environ.get("PILOT_BACKUP_DIR", str(default_root / "pilot-db-backups"))).expanduser().resolve()
    workspace = Path(__file__).resolve().parents[2]
    repo_roots = [workspace / name for name in ("pasalo.os", "ceodashboard", "modern trade website")]
    if any(backup_dir == root or root in backup_dir.parents for root in repo_roots):
        fail("PILOT_BACKUP_DIR must be outside all three application repositories.")
    backup_dir.mkdir(parents=True, exist_ok=True)
    bucket = os.environ.get("PILOT_S3_BUCKET", "").strip()
    if bucket and shutil.which("aws") is None:
        fail("PILOT_S3_BUCKET is set but AWS CLI is unavailable.")
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    names = [args.database] if args.database else list(DATABASES)
    staged = []
    with tempfile.TemporaryDirectory(prefix="pilot-db-backup-") as temp:
        try:
            for name in names:
                meta = table_stats(name)
                if meta["tables"] < 1:
                    fail(f"Database {name} has no user tables; refusing to treat it as a valid pilot backup.")
                filename = f"{name}_{args.tier}_{stamp}.dump"
                temp_path = Path(temp) / filename
                run(["pg_dump", "--format=custom", "--file", temp_path, "--no-password"], env=db_env(name))
                verify_backup(temp_path)
                staged.append((name, filename, temp_path, meta))
            for name, filename, temp_path, meta in staged:
                target = backup_dir / filename
                sidecar = target.with_suffix(".json")
                if target.exists():
                    fail(f"Backup target already exists; refusing to overwrite {filename}.")
                if sidecar.exists():
                    fail(f"Backup manifest already exists; refusing to overwrite {sidecar.name}.")
                staged_target = target.with_name(target.name + ".partial")
                if staged_target.exists():
                    fail(f"Partial backup file already exists; refusing to overwrite {staged_target.name}.")
                try:
                    shutil.copyfile(temp_path, staged_target)
                    os.chmod(staged_target, 0o600)
                    verify_backup(staged_target)
                    os.replace(staged_target, target)
                finally:
                    staged_target.unlink(missing_ok=True)
                sidecar_temp = sidecar.with_name(sidecar.name + ".partial")
                sidecar_temp.write_text(json.dumps({"database": name, "tier": args.tier, "created_utc": stamp, "sha256": sha256_file(target), "verification": meta}, indent=2) + "\n", encoding="utf-8")
                os.chmod(sidecar_temp, 0o600)
                os.replace(sidecar_temp, sidecar)
                if bucket:
                    prefix = os.environ.get("PILOT_S3_PREFIX", "pilot-postgresql").strip("/")
                    key = f"{prefix}/{filename}" if prefix else filename
                    cmd = ["aws", "s3", "cp", target, f"s3://{bucket}/{key}"]
                    endpoint = os.environ.get("PILOT_S3_ENDPOINT_URL")
                    if endpoint:
                        cmd.extend(["--endpoint-url", endpoint])
                    region = os.environ.get("PILOT_S3_REGION")
                    if region:
                        cmd.extend(["--region", region])
                    if os.environ.get("PILOT_S3_SSE", "AES256"):
                        cmd.extend(["--sse", os.environ.get("PILOT_S3_SSE", "AES256")])
                    run(cmd)
                    metadata_key = f"{prefix}/{sidecar.name}" if prefix else sidecar.name
                    metadata_cmd = ["aws", "s3", "cp", sidecar, f"s3://{bucket}/{metadata_key}"]
                    if endpoint:
                        metadata_cmd.extend(["--endpoint-url", endpoint])
                    if region:
                        metadata_cmd.extend(["--region", region])
                    run(metadata_cmd)
                print(f"Backup verified: {name} {args.tier} ({target.stat().st_size} bytes)")
            if bucket:
                print("Offsite upload completed for all requested databases.")
                apply_remote_retention(bucket, names, args.tier, TIERS[args.tier], temp)
            apply_local_retention(backup_dir, names, args.tier, TIERS[args.tier])
        except Exception:
            # Any already-published file is a complete individually verified
            # backup. Never rotate previous backups after a failed run.
            raise



def apply_remote_retention(bucket, names, tier, keep, temp_dir):
    prefix = os.environ.get("PILOT_S3_PREFIX", "pilot-postgresql").strip("/")
    endpoint = os.environ.get("PILOT_S3_ENDPOINT_URL")
    region = os.environ.get("PILOT_S3_REGION")
    common = ["aws", "s3api"]
    if endpoint:
        common.extend(["--endpoint-url", endpoint])
    if region:
        common.extend(["--region", region])
    for name in names:
        folder = f"{prefix}/" if prefix else ""
        start = f"{folder}{name}_{tier}_"
        output = run(common + ["list-objects-v2", "--bucket", bucket, "--prefix", start, "--output", "json"], capture=True)
        try:
            contents = json.loads(output).get("Contents", [])
        except json.JSONDecodeError:
            fail("Object storage returned an unreadable backup listing; retention was skipped.")
        items = sorted((row["Key"] for row in contents if row.get("Key", "").endswith(".dump")), key=lambda key: timestamp(key), reverse=True)
        valid = []
        for key in items:
            local = Path(temp_dir) / (name + "_remote_check.dump")
            cmd = ["aws", "s3", "cp", f"s3://{bucket}/{key}", local]
            if endpoint:
                cmd.extend(["--endpoint-url", endpoint])
            if region:
                cmd.extend(["--region", region])
            run(cmd)
            try:
                verify_backup(local)
                metadata_key = key[:-5] + ".json"
                metadata_local = Path(temp_dir) / (name + "_remote_check.json")
                metadata_cmd = ["aws", "s3", "cp", f"s3://{bucket}/{metadata_key}", metadata_local]
                if endpoint:
                    metadata_cmd.extend(["--endpoint-url", endpoint])
                if region:
                    metadata_cmd.extend(["--region", region])
                run(metadata_cmd)
                manifest = json.loads(metadata_local.read_text(encoding="utf-8"))
                if manifest.get("sha256") != sha256_file(local):
                    fail(f"Remote backup checksum mismatch: {key}")
                valid.append(key)
            except Exception:
                print(f"Retaining invalid/unverified object for inspection: {key}", file=sys.stderr)
            finally:
                local.unlink(missing_ok=True)
                (Path(temp_dir) / (name + "_remote_check.json")).unlink(missing_ok=True)
        for key in valid[keep:]:
            run(common + ["delete-object", "--bucket", bucket, "--key", key])
            print(f"Retention removed old verified object: {key}")


def apply_local_retention(directory, names, tier, keep):
    for name in names:
        files = sorted(directory.glob(f"{name}_{tier}_*.dump"), key=timestamp, reverse=True)
        valid = []
        for path in files:
            try:
                verify_backup(path)
                manifest_path = path.with_suffix(".json")
                if manifest_path.is_file():
                    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                    if manifest.get("sha256") != sha256_file(path):
                        fail(f"Backup checksum mismatch: {path.name}")
                valid.append(path)
            except Exception:
                print(f"Retaining invalid/unverified backup for inspection: {path.name}", file=sys.stderr)
        for path in valid[keep:]:
            path.unlink()
            path.with_suffix(".json").unlink(missing_ok=True)
            print(f"Retention removed old verified backup: {path.name}")


def restore(args, services):
    if args.database not in DATABASES:
        fail("Database must be one of: pasalo, ceo, commerce.")
    if args.target_db != f"{args.database}_restore_test":
        fail(f"Restore target must be exactly {args.database}_restore_test.")
    if len(args.target_db.encode("utf-8")) > 63:
        fail("Restore target exceeds PostgreSQL's 63-byte identifier limit.")
    if args.target_db in {services[n]["dbname"] for n in DATABASES}:
        fail("Restore target matches a configured source database; refusing to restore.")
    source = Path(args.backup).expanduser().resolve(strict=True)
    if not source.name.startswith(args.database + "_"):
        fail("Backup filename does not match the selected logical database.")
    verify_backup(source)
    manifest_path = source.with_suffix(".json")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.is_file() else None
    if manifest and manifest.get("sha256") != sha256_file(source):
        fail("Backup checksum does not match its manifest.")
    # Refuse overwrite: create database has no force/drop path in this tool.
    admin_service = os.environ.get("PILOT_PG_ADMIN_SERVICE")
    if not admin_service:
        fail("Set PILOT_PG_ADMIN_SERVICE to a protected PostgreSQL service profile for database creation/checks.")
    service_file = os.environ.get("PILOT_PG_SERVICE_FILE") or os.environ.get("PGSERVICEFILE")
    cfg = configparser.ConfigParser(interpolation=None)
    cfg.read(service_file)
    if admin_service not in cfg:
        fail("PILOT_PG_ADMIN_SERVICE must name a section in the protected service file.")
    admin_item = cfg[admin_service]
    if "password" in admin_item:
        fail("Do not store a password in the restore service profile; use PGPASSFILE or PGPASSWORD.")
    admin_host = admin_item.get("host", "").lower()
    if admin_host not in {"localhost", "127.0.0.1", "::1"}:
        fail("Restore-test database creation is restricted to loopback PostgreSQL hosts.")
    if cfg[admin_service].get("dbname", "postgres") != "postgres":
        fail("The restore admin service must connect to the maintenance database named postgres.")
    env = os.environ.copy()
    env["PGSERVICEFILE"] = service_file
    env["PGSERVICE"] = admin_service
    exists = run(["psql", "--no-password", "--no-psqlrc", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1", "--dbname", "postgres", "--command", f"SELECT 1 FROM pg_database WHERE datname = '{args.target_db}'"], env=env, capture=True)
    if exists:
        fail(f"Restore target {args.target_db} already exists; no database was changed.")
    run(["createdb", "--no-password", "--maintenance-db=service=" + admin_service, args.target_db], env=env)
    try:
        run(["pg_restore", "--no-password", "--exit-on-error", "--no-owner", "--no-privileges", "--dbname", args.target_db, source], env=env)
        verify_target(args.database, args.target_db, source, manifest, admin_service, env)
    except Exception:
        print(f"Restore failed; preserved {args.target_db} for inspection.", file=sys.stderr)
        raise


def verify_target(database, target, source, manifest, admin_service, env):
    stats = table_stats_for_target(target, env)
    if stats["tables"] < 1:
        fail("Restored database has no user tables.")
    if not stats["migrations"]:
        fail("Restored database has no recognized migration ledger; inspect app-specific migration history.")
    if not any(row.get("rows", 0) > 0 for row in stats["migrations"]):
        fail("Restored database has no applied migration records.")
    if manifest:
        expected = manifest["verification"]
        for section in ("migrations", "representative"):
            before = {row["table"]: row["rows"] for row in expected.get(section, [])}
            after = {row["table"]: row["rows"] for row in stats.get(section, [])}
            if before != after:
                message = f"Restored {section} row counts differ from the backup manifest."
                if os.environ.get("PILOT_STRICT_RESTORE_COUNTS") == "1":
                    fail(message)
                print("WARNING: " + message, file=sys.stderr)
    print(json.dumps({"restore_target": target, "source_file": source.name, "verification": stats}, indent=2))


def verify_test(args, services):
    target = args.target_db
    if target != f"{args.database}_restore_test":
        fail(f"Verification target must be exactly {args.database}_restore_test.")
    source = Path(args.backup).expanduser().resolve(strict=True)
    if not source.name.startswith(args.database + "_"):
        fail("Backup filename does not match the selected logical database.")
    verify_backup(source)
    manifest_path = source.with_suffix(".json")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.is_file() else None
    if manifest and manifest.get("sha256") != sha256_file(source):
        fail("Backup checksum does not match its manifest.")
    service_file = os.environ.get("PILOT_PG_SERVICE_FILE") or os.environ.get("PGSERVICEFILE")
    cfg = configparser.ConfigParser(interpolation=None)
    cfg.read(service_file)
    admin_service = os.environ.get("PILOT_PG_ADMIN_SERVICE")
    if not admin_service or admin_service not in cfg:
        fail("PILOT_PG_ADMIN_SERVICE must name a protected PostgreSQL service profile.")
    if "password" in cfg[admin_service]:
        fail("Do not store a password in the restore service profile; use PGPASSFILE or PGPASSWORD.")
    if cfg[admin_service].get("host", "").lower() not in {"localhost", "127.0.0.1", "::1"}:
        fail("Restore-test verification is restricted to loopback PostgreSQL hosts.")
    env = os.environ.copy()
    env["PGSERVICEFILE"] = service_file
    env["PGSERVICE"] = admin_service
    exists = run(["psql", "--no-password", "--no-psqlrc", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1", "--dbname", "postgres", "--command", f"SELECT 1 FROM pg_database WHERE datname = '{target}'"], env=env, capture=True)
    if not exists:
        fail(f"Restore-test database {target} does not exist.")
    verify_target(args.database, target, source, manifest, admin_service, env)


def table_stats_for_target(target, env):
    target_env = dict(env)
    target_env["PGDATABASE"] = target
    sql = """SELECT json_build_object(
      'database', current_database(),
      'tables', (SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') AND table_type='BASE TABLE'),
      'migrations', COALESCE((SELECT json_agg(json_build_object('table', table_name, 'rows', row_count)) FROM (
        SELECT table_name, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint AS row_count
        FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('_prisma_migrations','schema_migrations','prisma_migrations')
      ) m), '[]'::json),
      'representative', COALESCE((SELECT json_agg(json_build_object('table', table_name, 'rows', row_count)) FROM (
        SELECT table_name, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint AS row_count
        FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY(ARRAY['users','User','organizations','Organization','stores','Store','branches','Branch','products','Product','ProductUnit','customers','Customer','invoices','Invoice','InvoiceItem','orders','Order','sales','purchase_orders','purchase_items','inventory_transactions','inventory_items','InventoryItem','GoodsReceipt','GoodsReceiptItem','ledger_entries','journal_entries','accounts','batch_inventory'])
      ) r), '[]'::json)
    )::text"""
    raw = run(["psql", "--no-password", "--no-psqlrc", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1", "--dbname", target, "--command", sql], env=target_env, capture=True)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        fail(f"Could not read verification metadata from restore target {target}.")


def main():
    parser = argparse.ArgumentParser(description="Shared PASALHO pilot PostgreSQL backup and isolated restore utility.")
    sub = parser.add_subparsers(dest="command", required=True)
    b = sub.add_parser("backup", help="Create verified custom-format dumps.")
    b.add_argument("--tier", choices=TIERS, required=True)
    b.add_argument("--database", choices=DATABASES, help="Default: all three logical databases.")
    r = sub.add_parser("restore-test", help="Restore one backup into a new, explicit *_restore_test database.")
    r.add_argument("--database", choices=DATABASES, required=True, help="Logical backup identity.")
    r.add_argument("--backup", required=True)
    r.add_argument("--target-db", required=True)
    v = sub.add_parser("verify-test", help="Read-only verification of an existing *_restore_test database.")
    v.add_argument("--database", choices=DATABASES, required=True)
    v.add_argument("--backup", required=True)
    v.add_argument("--target-db", required=True)
    args = parser.parse_args()
    try:
        services = service_config()
        if args.command == "backup":
            backup(args)
        elif args.command == "restore-test":
            restore(args, services)
        else:
            verify_test(args, services)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
