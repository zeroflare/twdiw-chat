# D1 Database Migrations

This directory contains SQL migrations for the twdiw-chat D1 database.

## Migration Files

1. **0001_create_member_profiles.sql** - Creates the `member_profiles` table
   - Stores user account information
   - Supports encrypted fields (gender, interests) at application level
   - Includes OIDC subject ID and VC DID linking
   - Status tracking: GENERAL → VERIFIED

2. **0002_create_forums.sql** - Creates the `forums` table
   - Manages rank-gated forum access
   - Links to tlk.io chat channels
   - Rank-based authorization (Gold/Silver/Bronze)

3. **0003_create_private_chat_sessions.sql** - Creates the `private_chat_sessions` table
   - Manages 1-on-1 chat sessions
   - Supports DAILY_MATCH and GROUP_INITIATED types
   - Automatic expiry tracking
   - Prevents self-chat sessions

## Security Features

All migrations include:
- ✅ CHECK constraints for data validation
- ✅ Enum validation for status/type fields
- ✅ Unique constraints on critical fields
- ✅ Foreign key references (enforced at application level)
- ✅ Performance indexes on frequently queried columns
- ✅ Timestamp validation (creation before expiry)

## Setup Instructions

### Step 1: Create the D1 Database

```bash
# Create the database (remote)
wrangler d1 create twdiw-chat-db

# Copy the database_id from the output and update wrangler.toml
```

### Step 2: Update wrangler.toml

Replace the placeholder `database_id` in `wrangler.toml` with the actual database ID from Step 1:

```toml
[[d1_databases]]
binding = "DB"
database_name = "twdiw-chat-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # Replace with actual ID
```

### Step 3: Apply Migrations Locally (Development)

```bash
# Apply all migrations to local D1 database
wrangler d1 migrations apply twdiw-chat-db --local
```

### Step 4: Apply Migrations Remotely (Production)

```bash
# Apply all migrations to remote D1 database
wrangler d1 migrations apply twdiw-chat-db --remote
```

## Testing the Setup

### Check Local Database

```bash
# Execute a query against local D1
wrangler d1 execute twdiw-chat-db --local --command="SELECT name FROM sqlite_master WHERE type='table';"
```

Expected output:
```
member_profiles
forums
private_chat_sessions
```

### Check Remote Database

```bash
# Execute a query against remote D1
wrangler d1 execute twdiw-chat-db --remote --command="SELECT name FROM sqlite_master WHERE type='table';"
```

## Rollback Plan

If you need to rollback migrations:

### Option 1: Drop and Recreate (Development Only)

```bash
# Delete local .wrangler database
rm -rf .wrangler/state/v3/d1

# Re-apply migrations
wrangler d1 migrations apply twdiw-chat-db --local
```

### Option 2: Manual Rollback (Production)

Create a rollback migration:

```sql
-- migrations/0004_rollback_to_baseline.sql
DROP TABLE IF EXISTS private_chat_sessions;
DROP TABLE IF EXISTS forums;
DROP TABLE IF EXISTS member_profiles;
```

Then apply:
```bash
wrangler d1 execute twdiw-chat-db --remote --file=./migrations/0004_rollback_to_baseline.sql
```

## Development Workflow

1. Make schema changes by creating new migration files (0004_xxx.sql, 0005_xxx.sql, etc.)
2. Test locally first: `wrangler d1 migrations apply twdiw-chat-db --local`
3. Verify with test queries
4. Apply to remote: `wrangler d1 migrations apply twdiw-chat-db --remote`

## Encryption Notes

The following fields are marked for **application-level encryption**:
- `member_profiles.gender`
- `member_profiles.interests`

The encryption key should be:
- Stored in Wrangler secrets: `wrangler secret put ENCRYPTION_KEY`
- Use AES-256-GCM algorithm
- Never committed to version control
- Rotated periodically

## Migration Naming Convention

Format: `NNNN_description.sql`
- `NNNN`: 4-digit sequential number (0001, 0002, etc.)
- `description`: Snake_case description of the change
- Examples:
  - `0001_create_member_profiles.sql`
  - `0002_create_forums.sql`
  - `0003_create_private_chat_sessions.sql`
  - `0004_add_email_to_members.sql` (future example)

## Troubleshooting

### Error: "No migrations to apply"

- Check that migration files are in the `migrations/` directory
- Verify file naming follows the convention (NNNN_*.sql)
- Ensure migrations haven't already been applied

### Error: "Database not found"

- Verify `database_id` in `wrangler.toml` is correct
- Run `wrangler d1 list` to see available databases
- Create the database if it doesn't exist

### Error: "Foreign key constraint failed"

- D1 doesn't enforce foreign keys at the database level
- Implement foreign key validation in application code
- See repository implementations in `src/infrastructure/repositories/`
