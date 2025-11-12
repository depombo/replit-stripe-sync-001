import { pool } from './db';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Run Stripe Sync Engine migrations with Neon compatibility
 * 
 * The official Stripe Sync Engine migrations hardcode "postgres" role which doesn't exist
 * in Neon (uses "neondb_owner"). We manually run the migrations and replace the role.
 */
export async function runStripeMigrations(schema: string = 'stripe'): Promise<void> {
  const dbUser = process.env.PGUSER || 'neondb_owner';
  
  try {
    console.log(`[Migration] Running Stripe migrations for schema "${schema}"...`);
    
    // Find the migrations directory
    const migrationsDirCommonJS = join(__dirname, '../node_modules/@supabase/stripe-sync-engine/dist/migrations');
    const migrationsDirESM = join(dirname(__dirname), 'node_modules/@supabase/stripe-sync-engine/dist/migrations');
    
    let migrationsDir = migrationsDirCommonJS;
    try {
      readdirSync(migrationsDirCommonJS);
    } catch {
      migrationsDir = migrationsDirESM;
    }
    
    // Get all migration files
    const files = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    console.log(`[Migration] Found ${files.length} migration files`);
    
    // Create migrations table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${schema}.migrations (
        id INT PRIMARY KEY,
        name TEXT NOT NULL,
        hash TEXT NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Get already executed migrations
    const executedResult = await pool.query(
      `SELECT name FROM ${schema}.migrations ORDER BY id`
    );
    const executedMigrations = new Set(executedResult.rows.map(r => r.name));
    
    // Run pending migrations
    for (const file of files) {
      // Extract migration name (e.g., "0000_initial_migration.sql" -> "initial_migration")
      const match = file.match(/^\d+_(.+)\.sql$/);
      if (!match) continue;
      
      const migrationName = match[1];
      const migrationId = parseInt(file.split('_')[0]);
      
      if (executedMigrations.has(migrationName)) {
        console.log(`[Migration] Skipping ${migrationName} (already executed)`);
        continue;
      }
      
      console.log(`[Migration] Running ${migrationName}...`);
      
      // Read the SQL file
      const filePath = join(migrationsDir, file);
      let sql = readFileSync(filePath, 'utf-8');
      
      // Replace hardcoded "postgres" role with Neon role
      sql = sql.replace(/owner to postgres/gi, `owner to ${dbUser}`);
      sql = sql.replace(/OWNER TO postgres/gi, `OWNER TO ${dbUser}`);
      
      // Replace schema placeholder if present
      sql = sql.replace(/\$\{schema\}/g, schema);
      
      try {
        // Run the migration SQL
        await pool.query(sql);
        
        // Record successful migration
        await pool.query(
          `INSERT INTO ${schema}.migrations (id, name, hash, executed_at) 
           VALUES ($1, $2, $3, NOW())`,
          [migrationId, migrationName, 'manual_migration']
        );
        
        console.log(`[Migration] ✓ ${migrationName} completed`);
      } catch (error: any) {
        console.error(`[Migration] Failed on ${migrationName}:`, error.message);
        throw error;
      }
    }
    
    // Ensure all objects are owned by the Neon role
    console.log(`[Migration] Ensuring all objects owned by ${dbUser}...`);
    
    await pool.query(`
      ALTER SCHEMA ${schema} OWNER TO ${dbUser};
      
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = '${schema}'
        LOOP
          EXECUTE 'ALTER TABLE ${schema}.' || quote_ident(r.tablename) || ' OWNER TO ${dbUser}';
        END LOOP;
        
        FOR r IN SELECT routine_name FROM information_schema.routines WHERE routine_schema = '${schema}'
        LOOP
          EXECUTE 'ALTER FUNCTION ${schema}.' || quote_ident(r.routine_name) || ' OWNER TO ${dbUser}';
        END LOOP;
      END $$;
      
      GRANT USAGE ON SCHEMA ${schema} TO ${dbUser};
      GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ${schema} TO ${dbUser};
      GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ${schema} TO ${dbUser};
      GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA ${schema} TO ${dbUser};
    `);
    
    console.log(`[Migration] ✓ All migrations complete`);
  } catch (error: any) {
    console.error('[Migration] Fatal error:', error.message);
    throw error;
  }
}
