import { pool } from './db';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Run Stripe Sync Engine migrations with Neon compatibility patches
 * The official migrations fail on Neon because they try to set ownership
 * to a "postgres" role that doesn't exist in serverless PostgreSQL
 */
export async function runStripeMigrations(schema: string = 'stripe'): Promise<void> {
  const migrationDir = path.resolve(
    __dirname,
    '../node_modules/@supabase/stripe-sync-engine/dist/migrations'
  );

  try {
    // Create schema if it doesn't exist
    await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schema};`);
    console.log(`[Migration] Schema "${schema}" ready`);

    // Create migration tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${schema}._migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Get list of migration files
    const files = await fs.readdir(migrationDir);
    const sqlFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort(); // Ensure migrations run in order

    console.log(`[Migration] Found ${sqlFiles.length} migration files`);

    for (const file of sqlFiles) {
      const migrationId = file.replace('.sql', '');
      
      // Check if already applied
      const result = await pool.query(
        `SELECT id FROM ${schema}._migrations WHERE id = $1`,
        [migrationId]
      );

      if (result.rows.length > 0) {
        console.log(`[Migration] Skipping ${migrationId} (already applied)`);
        continue;
      }

      console.log(`[Migration] Running ${migrationId}...`);

      // Read migration file
      const filePath = path.join(migrationDir, file);
      let sql = await fs.readFile(filePath, 'utf-8');

      // Patch: Remove "ALTER FUNCTION ... OWNER TO postgres" lines
      // These fail on Neon because the postgres role doesn't exist
      sql = sql.replace(/alter function .+ owner to postgres;/gi, '-- Skipped: ALTER FUNCTION OWNER (Neon compatibility)');
      
      // Replace schema placeholder if present
      sql = sql.replace(/stripe\./g, `${schema}.`);

      try {
        // Run the migration
        await pool.query(sql);

        // Mark as applied
        await pool.query(
          `INSERT INTO ${schema}._migrations (id) VALUES ($1)`,
          [migrationId]
        );

        console.log(`[Migration] ✓ ${migrationId} complete`);
      } catch (error: any) {
        console.error(`[Migration] ✗ ${migrationId} failed:`, error.message);
        throw new Error(`Migration ${migrationId} failed: ${error.message}`);
      }
    }

    console.log(`[Migration] All migrations complete`);
  } catch (error: any) {
    console.error('[Migration] Fatal error:', error);
    throw error;
  }
}
