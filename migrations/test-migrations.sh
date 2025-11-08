#!/bin/bash
# Test script to validate migration SQL syntax
# This script checks that all migration files are valid SQL

set -e

echo "🧪 Testing D1 Migrations Syntax..."
echo ""

MIGRATIONS_DIR="$(cd "$(dirname "$0")" && pwd)"
MIGRATION_FILES=("$MIGRATIONS_DIR"/*.sql)

if [ ${#MIGRATION_FILES[@]} -eq 0 ]; then
    echo "❌ No migration files found in $MIGRATIONS_DIR"
    exit 1
fi

echo "Found ${#MIGRATION_FILES[@]} migration file(s):"
for file in "${MIGRATION_FILES[@]}"; do
    echo "  - $(basename "$file")"
done
echo ""

# Check if sqlite3 is available for syntax validation
if ! command -v sqlite3 &> /dev/null; then
    echo "⚠️  sqlite3 not found - skipping syntax validation"
    echo "✅ Migration files exist and are readable"
    exit 0
fi

# Create a temporary database for testing
TEMP_DB=$(mktemp -t migration-test-XXXXXX.db)
trap "rm -f $TEMP_DB" EXIT

echo "🔍 Validating SQL syntax using sqlite3..."
echo ""

for migration_file in "${MIGRATION_FILES[@]}"; do
    filename=$(basename "$migration_file")
    echo -n "  Testing $filename ... "

    if sqlite3 "$TEMP_DB" < "$migration_file" 2>&1; then
        echo "✅"
    else
        echo "❌"
        echo ""
        echo "Error in $filename:"
        sqlite3 "$TEMP_DB" < "$migration_file" 2>&1 || true
        exit 1
    fi
done

echo ""
echo "🎉 All migrations are syntactically valid!"
echo ""

# Show created tables
echo "📊 Created tables:"
sqlite3 "$TEMP_DB" "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" | while read -r table; do
    echo "  - $table"
done

echo ""

# Show created indexes
echo "📑 Created indexes:"
sqlite3 "$TEMP_DB" "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name;" | while read -r index; do
    echo "  - $index"
done

echo ""
echo "✅ Migration test completed successfully!"
