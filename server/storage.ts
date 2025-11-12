import {
  users,
  generations,
  userCredits,
  type User,
  type UpsertUser,
  type Generation,
  type InsertGeneration,
  type UserCredit,
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
  
  // Credits operations
  getUserCredits(userId: string): Promise<UserCredit | undefined>;
  deductCredit(userId: string): Promise<void>;
  addCredits(userId: string, amount: number): Promise<void>;
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
    try {
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
    } catch (error) {
      console.error('Error querying stripe.customers:', error);
      return null;
    }
  }

  async getStripeCustomerById(stripeCustomerId: string): Promise<StripeCustomer | null> {
    try {
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
    } catch (error) {
      console.error('Error querying stripe.customers:', error);
      return null;
    }
  }

  // Subscription operations - query stripe.subscriptions table directly
  // Note: Includes all valid paid states (active, trialing, past_due, unpaid)
  async getActiveSubscription(stripeCustomerId: string): Promise<StripeSubscription | null> {
    try {
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
    } catch (error) {
      console.error('Error querying stripe.subscriptions:', error);
      return null;
    }
  }

  // Generation operations
  async createGeneration(generation: InsertGeneration): Promise<Generation> {
    const [created] = await db
      .insert(generations)
      .values(generation)
      .returning();
    return created;
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

  // Credits operations
  async getUserCredits(userId: string): Promise<UserCredit | undefined> {
    const [credits] = await db
      .select()
      .from(userCredits)
      .where(eq(userCredits.userId, userId));
    
    if (!credits) {
      // Initialize with 0 credits
      const [newCredits] = await db
        .insert(userCredits)
        .values({ userId, credits: 0 })
        .returning();
      return newCredits;
    }
    
    return credits;
  }

  async deductCredit(userId: string): Promise<void> {
    await db
      .update(userCredits)
      .set({ 
        credits: sql`credits - 1`,
        updatedAt: new Date(),
      })
      .where(eq(userCredits.userId, userId));
  }

  async addCredits(userId: string, amount: number): Promise<void> {
    const existing = await this.getUserCredits(userId);
    
    if (existing) {
      await db
        .update(userCredits)
        .set({ 
          credits: sql`credits + ${amount}`,
          updatedAt: new Date(),
        })
        .where(eq(userCredits.userId, userId));
    } else {
      await db
        .insert(userCredits)
        .values({ userId, credits: amount });
    }
  }
}

export const storage = new DatabaseStorage();
