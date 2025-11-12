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
  try {
    // Run official migrations (will create tables but fail on owner change)
    await runMigrations({
      databaseUrl: process.env.DATABASE_URL!,
      schema,
      logger: {
        info: (msg: string) => console.log(`[Migration] ${msg}`),
        error: (msgOrObj: any) => {
          // Error can be a string or an object with message property
          const msg = typeof msgOrObj === 'string' ? msgOrObj : msgOrObj?.message || String(msgOrObj);
          // Expected error: ALTER FUNCTION OWNER fails on Neon
          if (msg.includes('postgres') && msg.includes('does not exist')) {
            console.log(`[Migration] Skipping owner change (Neon uses ${process.env.PGUSER})`);
          } else {
            console.error(`[Migration] ${msg}`);
          }
        },
        warn: (msg: string) => console.warn(`[Migration] ${msg}`),
        debug: (msg: string) => console.debug(`[Migration] ${msg}`),
      },
    });

    // Grant permissions to the actual Neon role (neondb_owner)
    const dbUser = process.env.PGUSER || 'neondb_owner';
    console.log(`[Migration] Granting permissions to ${dbUser}...`);
    
    await pool.query(`
      GRANT USAGE ON SCHEMA ${schema} TO ${dbUser};
      GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ${schema} TO ${dbUser};
      GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ${schema} TO ${dbUser};
      GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA ${schema} TO ${dbUser};
    `);
    
    console.log(`[Migration] ✓ Permissions granted to ${dbUser}`);
  } catch (error: any) {
    console.error('[Migration] Error:', error.message);
    throw error;
  }
}
