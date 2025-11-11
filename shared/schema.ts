import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  integer,
  boolean,
  text,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Stripe customers table - synced via stripe-sync-engine
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  stripeCustomerId: varchar("stripe_customer_id").notNull().unique(),
  email: varchar("email"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Customer = typeof customers.$inferSelect;

// Stripe subscriptions table - synced via stripe-sync-engine
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey(),
  customerId: varchar("customer_id").references(() => customers.id).notNull(),
  stripeSubscriptionId: varchar("stripe_subscription_id").notNull().unique(),
  status: varchar("status").notNull(), // active, canceled, past_due, etc.
  priceId: varchar("price_id"),
  productId: varchar("product_id"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Subscription = typeof subscriptions.$inferSelect;

// One-time payments/credits table - synced via stripe-sync-engine
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => customers.id).notNull(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id").unique(),
  amount: integer("amount").notNull(),
  status: varchar("status").notNull(), // succeeded, pending, failed
  creditsGranted: integer("credits_granted").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Payment = typeof payments.$inferSelect;

// Palette generations tracking
export const generations = pgTable("generations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  palette: jsonb("palette").notNull(), // Array of color objects
  harmony: varchar("harmony"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertGenerationSchema = createInsertSchema(generations).omit({
  id: true,
  createdAt: true,
});

export type InsertGeneration = z.infer<typeof insertGenerationSchema>;
export type Generation = typeof generations.$inferSelect;

// User credits tracking (for one-time purchases)
export const userCredits = pgTable("user_credits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  credits: integer("credits").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UserCredit = typeof userCredits.$inferSelect;
