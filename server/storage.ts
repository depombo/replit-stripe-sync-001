import {
  users,
  generations,
  type User,
  type UpsertUser,
  type Generation,
  type InsertGeneration,
} from "@shared/schema";
import { db, pool } from "./db";
import { eq, desc, and, gte, sql } from "drizzle-orm";

// Types for Stripe schema data (from stripe.customers and stripe.subscriptions)
export interface StripeCustomer {
  id: string;
  email: string | null;
  metadata: Record<string, any>;
}

export interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  items: {
    data: Array<{
      price: {
        id: string;
        product: string;
      }
    }>;
  };
  current_period_start: number;
  current_period_end: number;
}

// Interface for storage operations
export interface IStorage {
  // User operations (IMPORTANT: mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Customer operations (query stripe.customers schema)
  getStripeCustomerByUserId(userId: string): Promise<StripeCustomer | null>;
  getStripeCustomerById(stripeCustomerId: string): Promise<StripeCustomer | null>;
  
  // Subscription operations (query stripe.subscriptions schema)
  getActiveSubscription(stripeCustomerId: string): Promise<StripeSubscription | null>;
  
  // Generation operations
  createGeneration(generation: InsertGeneration): Promise<Generation>;
  getUserGenerations(userId: string): Promise<Generation[]>;
  countUserGenerationsThisMonth(userId: string): Promise<number>;
  
  // Atomic check and create (prevents race conditions)
  createGenerationIfAllowed(
    userId: string,
    generation: InsertGeneration,
    isUnlimited: boolean,
    maxGenerations: number
  ): Promise<{ success: boolean; generation?: Generation; error?: string }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Customer operations - query stripe.customers table directly
  async getStripeCustomerByUserId(userId: string): Promise<StripeCustomer | null> {
    const result = await pool.query(
      `SELECT id, email, metadata 
       FROM stripe.customers 
       WHERE metadata->>'userId' = $1
       LIMIT 1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0] as StripeCustomer;
  }

  async getStripeCustomerById(stripeCustomerId: string): Promise<StripeCustomer | null> {
    const result = await pool.query(
      `SELECT id, email, metadata 
       FROM stripe.customers 
       WHERE id = $1
       LIMIT 1`,
      [stripeCustomerId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0] as StripeCustomer;
  }

  // Subscription operations - query stripe.subscriptions table directly
  // Note: Includes all valid paid states (active, trialing, past_due, unpaid)
  async getActiveSubscription(stripeCustomerId: string): Promise<StripeSubscription | null> {
    const result = await pool.query(
      `SELECT id, customer, status, items, current_period_start, current_period_end
       FROM stripe.subscriptions 
       WHERE customer = $1 
       AND status IN ('active', 'trialing', 'past_due', 'unpaid')
       LIMIT 1`,
      [stripeCustomerId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0] as StripeSubscription;
  }

  // Generation operations
  async createGeneration(generation: InsertGeneration): Promise<Generation> {
    const [created] = await db
      .insert(generations)
      .values(generation)
      .returning();
    return created;
  }

  // Atomic check and create generation (prevents race conditions on quota limits)
  async createGenerationIfAllowed(
    userId: string,
    generation: InsertGeneration,
    isUnlimited: boolean,
    maxGenerations: number
  ): Promise<{ success: boolean; generation?: Generation; error?: string }> {
    // Use a transaction with advisory lock to atomically check quota and insert
    return await db.transaction(async (tx) => {
      // Acquire transaction-level advisory lock on userId hash
      // This ensures concurrent requests for the same user serialize
      const userIdHash = Math.abs(userId.split('').reduce((hash, char) => {
        return ((hash << 5) - hash) + char.charCodeAt(0);
      }, 0));
      
      // Execute lock on the SAME transaction connection
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${userIdHash})`);
      
      // Now we have exclusive lock for this user - safe to check and insert
      let currentCount: number;
      
      if (maxGenerations === 1) {
        // Free tier - check total generations (lifetime)
        const result = await tx
          .select()
          .from(generations)
          .where(eq(generations.userId, userId));
        currentCount = result.length;
      } else {
        // Paid tier - check monthly generations
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const result = await tx
          .select()
          .from(generations)
          .where(
            and(
              eq(generations.userId, userId),
              gte(generations.createdAt, startOfMonth)
            )
          );
        currentCount = result.length;
      }
      
      // Check if quota exceeded (unless unlimited)
      if (!isUnlimited && currentCount >= maxGenerations) {
        return {
          success: false,
          error: "No generations remaining"
        };
      }
      
      // Quota OK - create generation
      const [newGeneration] = await tx
        .insert(generations)
        .values(generation)
        .returning();
      
      return {
        success: true,
        generation: newGeneration
      };
      // Lock is automatically released when transaction commits/rolls back
    });
  }

  async getUserGenerations(userId: string): Promise<Generation[]> {
    return await db
      .select()
      .from(generations)
      .where(eq(generations.userId, userId))
      .orderBy(desc(generations.createdAt));
  }

  async countUserGenerationsThisMonth(userId: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const result = await db
      .select()
      .from(generations)
      .where(
        and(
          eq(generations.userId, userId),
          gte(generations.createdAt, startOfMonth)
        )
      );
    
    return result.length;
  }
}

export const storage = new DatabaseStorage();
