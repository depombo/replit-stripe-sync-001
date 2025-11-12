import { pool } from './db';
import { runMigrations } from '@supabase/stripe-sync-engine';

/**
 * Run Stripe Sync Engine migrations with Neon compatibility
 * 
 * Known Issue: Migration 0012_add_updated_at.sql hardcodes "postgres" role
 * (GitHub Issue #77) which doesn't exist in Neon (uses "neondb_owner").
 * 
 * Solution: Let migrations run (they create tables even if owner change fails),
 * then grant permissions to the actual Neon role.
 */
export async function runStripeMigrations(schema: string = 'stripe'): Promise<void> {
  const dbUser = process.env.PGUSER || 'neondb_owner';
  
  try {
    // Run official migrations - will fail on "ALTER FUNCTION OWNER TO postgres"
    // but tables will be created before that error
    console.log(`[Migration] Running Stripe migrations for schema "${schema}"...`);
    
    try {
      await runMigrations({
        databaseUrl: process.env.DATABASE_URL!,
        schema,
        logger: {
          info: (msg: string) => console.log(`[Migration] ${msg}`),
          error: (msgOrObj: any) => console.error(`[Migration] ${msgOrObj}`),
          warn: (msg: string) => console.warn(`[Migration] ${msg}`),
          debug: (msg: string) => console.debug(`[Migration] ${msg}`),
        },
      });
    } catch (migrationError: any) {
      // Expected: migrations fail on "role postgres does not exist"
      // Tables are created before this error, so we can proceed
      if (migrationError.message?.includes('postgres') || 
          migrationError.cause?.includes('postgres')) {
        console.log(`[Migration] Handled expected Neon incompatibility (postgres role)`);
      } else {
        // Unexpected migration error - re-throw
        throw migrationError;
      }
    }

    // Explicitly reassign ownership of all objects to the Neon role
    // This ensures permissions work even if some objects were partially created
    console.log(`[Migration] Reassigning ownership to ${dbUser}...`);
    
    await pool.query(`
      -- Reassign schema ownership
      ALTER SCHEMA ${schema} OWNER TO ${dbUser};
      
      -- Reassign table ownership
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = '${schema}'
        LOOP
          EXECUTE 'ALTER TABLE ${schema}.' || quote_ident(r.tablename) || ' OWNER TO ${dbUser}';
        END LOOP;
      END $$;
      
      -- Reassign function ownership  
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN SELECT routine_name FROM information_schema.routines WHERE routine_schema = '${schema}'
        LOOP
          EXECUTE 'ALTER FUNCTION ${schema}.' || quote_ident(r.routine_name) || ' OWNER TO ${dbUser}';
        END LOOP;
      END $$;
      
      -- Grant all necessary permissions
      GRANT USAGE ON SCHEMA ${schema} TO ${dbUser};
      GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ${schema} TO ${dbUser};
      GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ${schema} TO ${dbUser};
      GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA ${schema} TO ${dbUser};
    `);
    
    console.log(`[Migration] ✓ Ownership and permissions configured for ${dbUser}`);
  } catch (error: any) {
    console.error('[Migration] Fatal error:', error.message);
    throw error;
  }
}
