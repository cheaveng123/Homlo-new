#!/usr/bin/env bash
#
# backup-homlo-production-schema.sh
#
# Export-only schema backup for the Homlo production Supabase project.
#
# This script performs a schema-only dump of the `public` schema from the
# production database. It does NOT export:
#   - Supabase-managed schemas (auth, storage, realtime, etc.)
#   - Database roles or privileges
#   - Extensions or their installation state
#   - Database-level publications (e.g., homlo_messaging)
#   - Supabase migration history (supabase_migrations schema)
#   - Any table data
#
# --- Safety guarantees -----------------------------------------------------
#
#   - Never connects to the staging project.
#   - Never uses PGPASSWORD or command-line password arguments.
#   - Never reads .env files or repository credentials.
#   - Never prints or logs credentials.
#   - Enforces PGSSLMODE=require for pg_dump (cannot be overridden by inherited
#     environment).
#   - Temporary password file is created with 0600 permissions and removed
#     via an EXIT trap, even on failure.
#   - Requires explicit operator confirmation before connecting.
#   - Writes dumps and manifests to temporary files, then atomically promotes
#     them to final filenames only after successful completion.

set -euo pipefail

# --- Configuration ---------------------------------------------------------

EXPECTED_PROJECT_REF="gwzknvycbzloomxhvslo"
BACKUP_DIR="$HOME/homlo-database-backups"
PG_HOST="aws-0-ap-northeast-2.pooler.supabase.com"
PG_PORT="5432"
PG_USER="postgres.${EXPECTED_PROJECT_REF}"
PG_DB="postgres"
TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
OUTPUT_FILE="${BACKUP_DIR}/homlo-production-schema-${TIMESTAMP}.sql"
MANIFEST_FILE="${BACKUP_DIR}/homlo-production-schema-${TIMESTAMP}.manifest.json"
PGPASSFILE=""
TEMP_DUMP=""
TEMP_MANIFEST=""
SQL_PROMOTED=false

# --- Cleanup ---------------------------------------------------------------

cleanup() {
    if [[ -n "${PGPASSFILE:-}" && -f "${PGPASSFILE}" ]]; then
        rm -f "${PGPASSFILE}"
    fi
    if [[ -n "${TEMP_DUMP:-}" && -f "${TEMP_DUMP}" ]]; then
        rm -f "${TEMP_DUMP}"
    fi
    if [[ -n "${TEMP_MANIFEST:-}" && -f "${TEMP_MANIFEST}" ]]; then
        rm -f "${TEMP_MANIFEST}"
    fi
}
trap cleanup EXIT

# --- Helpers ---------------------------------------------------------------

die() {
    echo "ERROR: $*" >&2
    exit 1
}

# --- Pre-flight checks -----------------------------------------------------

command -v pg_dump >/dev/null 2>&1 || die "pg_dump is not installed. Install PostgreSQL client tools."
command -v shasum >/dev/null 2>&1 || die "shasum is not available."

# Verify the resolved username contains the expected production project
# reference. The pooler hostname is shared across projects, so the project
# identifier is carried in the username (postgres.<project_ref>). Fail closed
# if it does not.
if [[ "${PG_USER}" != *"${EXPECTED_PROJECT_REF}"* ]]; then
    die "Resolved username '${PG_USER}' does not contain expected project reference '${EXPECTED_PROJECT_REF}'. Aborting."
fi

# --- Create backup directory -----------------------------------------------

if [[ ! -d "${BACKUP_DIR}" ]]; then
    mkdir -p "${BACKUP_DIR}" || die "Failed to create backup directory '${BACKUP_DIR}'."
    chmod 0700 "${BACKUP_DIR}" || die "Failed to set permissions on '${BACKUP_DIR}'."
elif [[ ! -w "${BACKUP_DIR}" ]]; then
    die "Backup directory '${BACKUP_DIR}' is not writable."
fi

# Enforce restrictive permissions whether newly created or pre-existing.
chmod 0700 "${BACKUP_DIR}" || die "Failed to set permissions on '${BACKUP_DIR}'."

# --- Verify output files do not already exist ------------------------------

if [[ -f "${OUTPUT_FILE}" ]]; then
    die "Output file '${OUTPUT_FILE}' already exists. Refusing to overwrite."
fi
if [[ -f "${MANIFEST_FILE}" ]]; then
    die "Manifest file '${MANIFEST_FILE}' already exists. Refusing to overwrite."
fi

# --- Confirmation ----------------------------------------------------------

echo "========================================================================"
echo " Homlo Production Schema Backup"
echo "========================================================================"
echo " Source project reference: ${EXPECTED_PROJECT_REF}"
echo " Database host:            ${PG_HOST}"
echo " Database name:            ${PG_DB}"
echo " Output file:              ${OUTPUT_FILE}"
echo " Schema:                   public (schema-only, no data)"
echo " Ownership:                --no-owner suppresses ALTER OWNER commands"
echo "                           but does NOT suppress ACL/GRANT statements."
echo "-----------------------------------------------------------------------"
echo " WARNING: This will connect to the production database at ${PG_HOST}."
echo "          Ensure you have explicit authorization to perform this export."
echo "========================================================================"
echo ""

read -r -p "Type '${EXPECTED_PROJECT_REF}' to confirm the source project reference: " CONFIRM_REF || die "Confirmation cancelled."
if [[ "${CONFIRM_REF}" != "${EXPECTED_PROJECT_REF}" ]]; then
    die "Project reference mismatch. Expected '${EXPECTED_PROJECT_REF}', got '${CONFIRM_REF}'. Aborting."
fi

read -r -p "Type 'yes' to proceed with the read-only schema export: " CONFIRM_YES || die "Confirmation cancelled."
if [[ "${CONFIRM_YES}" != "yes" ]]; then
    die "Confirmation not received. Aborting."
fi

echo ""

# --- Password prompt -------------------------------------------------------

read -r -s -p "Enter database password for user '${PG_USER}': " PG_PASSWORD || die "Failed to read password."
echo ""

if [[ -z "${PG_PASSWORD}" ]]; then
    die "Password cannot be empty."
fi

# --- Build temporary PGPASSFILE -------------------------------------------

PGPASSFILE="$(mktemp)" || die "Failed to create temporary password file."
chmod 0600 "${PGPASSFILE}" || die "Failed to set permissions on temporary password file."

# Escape backslash and colon for .pgpass format.
escaped_password=$(printf '%s' "${PG_PASSWORD}" | sed 's/\\/\\\\/g; s/:/\\:/g')

printf '%s:%s:%s:%s:%s\n' "${PG_HOST}" "${PG_PORT}" "${PG_DB}" "${PG_USER}" "${escaped_password}" > "${PGPASSFILE}"
export PGPASSFILE

# Immediately purge in-memory password material after writing the passfile.
unset PG_PASSWORD
unset escaped_password

# --- Execute pg_dump -------------------------------------------------------

echo "Exporting schema from ${PG_HOST} to temporary file..."

# Diagnostics: confirm the actual username and host being passed to pg_dump.
# No credentials or connection strings are printed.
printf 'Connecting to database as user: %s at host: %s\n' "$PG_USER" "$PG_HOST"

# Ensure the temporary PGPASSFILE is the only password source.
unset PGPASSWORD

TEMP_DUMP="$(mktemp "${BACKUP_DIR}/homlo-production-schema-XXXXXX.tmp.sql")" || die "Failed to create temporary dump file."
chmod 0600 "${TEMP_DUMP}" || die "Failed to set permissions on temporary dump file."

PGSSLMODE=require pg_dump \
    -h "${PG_HOST}" \
    -p "${PG_PORT}" \
    -U "${PG_USER}" \
    -d "${PG_DB}" \
    -n public \
    --schema-only \
    --no-owner \
    -f "${TEMP_DUMP}" \
    || die "pg_dump failed. Temporary file removed on exit."

# --- Verify output ---------------------------------------------------------

if [[ ! -s "${TEMP_DUMP}" ]]; then
    die "pg_dump completed but temporary dump file is empty."
fi

# Atomically promote the temporary dump to the final output file using a hard
# link. On macOS (BSD), mv -n is not supported, so we use ln instead, which
# fails if the destination already exists (including a symbolic link).
if [[ -f "${OUTPUT_FILE}" || -L "${OUTPUT_FILE}" ]]; then
    die "Output file '${OUTPUT_FILE}' already exists. Refusing to overwrite."
fi
ln "${TEMP_DUMP}" "${OUTPUT_FILE}" || die "Failed to create hard link for output file."
rm -f "${TEMP_DUMP}"
TEMP_DUMP=""
SQL_PROMOTED=true

# --- Manifest --------------------------------------------------------------

PG_DUMP_VERSION="$(pg_dump --version | head -n1)"
FILE_SIZE="$(wc -c < "${OUTPUT_FILE}")"
SHA256="$(shasum -a 256 "${OUTPUT_FILE}" | awk '{print $1}')"
MANIFEST_TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

TEMP_MANIFEST="$(mktemp "${BACKUP_DIR}/homlo-production-schema-XXXXXX.tmp.manifest.json")" || die "Failed to create temporary manifest file."
chmod 0600 "${TEMP_MANIFEST}" || die "Failed to set permissions on temporary manifest file."

cat > "${TEMP_MANIFEST}" <<MANIFEST_EOF
{
  "timestamp": "${MANIFEST_TIMESTAMP}",
  "source_project_ref": "${EXPECTED_PROJECT_REF}",
  "database_host": "${PG_HOST}",
  "database_name": "${PG_DB}",
  "pg_dump_version": "${PG_DUMP_VERSION}",
  "output_file": "${OUTPUT_FILE}",
  "file_size_bytes": ${FILE_SIZE},
  "sha256_checksum": "${SHA256}",
  "schema_only": true,
  "schema": "public"
}
MANIFEST_EOF

# Atomically promote the temporary manifest to the final manifest file using a
# hard link. On macOS (BSD), mv -n is not supported, so we use ln instead,
# which fails if the destination already exists (including a symbolic link).
if [[ -f "${MANIFEST_FILE}" || -L "${MANIFEST_FILE}" ]]; then
    die "Manifest file '${MANIFEST_FILE}' already exists. Refusing to overwrite."
fi
ln "${TEMP_MANIFEST}" "${MANIFEST_FILE}" || {
    # Manifest promotion failed after SQL was already promoted. Remove the
    # SQL backup we created so no incomplete backup remains.
    rm -f "${OUTPUT_FILE}"
    SQL_PROMOTED=false
    die "Failed to create hard link for manifest file."
}
rm -f "${TEMP_MANIFEST}"
TEMP_MANIFEST=""

# --- Success ---------------------------------------------------------------

echo ""
echo "========================================================================"
echo " Backup complete."
echo " Output file:   ${OUTPUT_FILE}"
echo " Manifest:      ${MANIFEST_FILE}"
echo " File size:     ${FILE_SIZE} bytes"
echo " SHA-256:       ${SHA256}"
echo "========================================================================"

exit 0