import {
  users,
  customers,
  subscriptions,
  payments,
  generations,
  userCredits,
  type User,
  type UpsertUser,
  type Customer,
  type Subscription,
  type Payment,
  type Generation,
  type InsertGeneration,
  type UserCredit,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, sql } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (IMPORTANT: mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Customer operations
  getCustomerByUserId(userId: string): Promise<Customer | undefined>;
  getCustomerByStripeId(stripeCustomerId: string): Promise<Customer | undefined>;
  
  // Subscription operations
  getActiveSubscription(customerId: string): Promise<Subscription | undefined>;
  
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

  // Customer operations
  async getCustomerByUserId(userId: string): Promise<Customer | undefined> {
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.userId, userId));
    return customer;
  }

  async getCustomerByStripeId(stripeCustomerId: string): Promise<Customer | undefined> {
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.stripeCustomerId, stripeCustomerId));
    return customer;
  }

  // Subscription operations
  async getActiveSubscription(customerId: string): Promise<Subscription | undefined> {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.customerId, customerId),
          eq(subscriptions.status, 'active')
        )
      );
    return subscription;
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
