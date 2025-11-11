import { useState } from "react";
import Header from "@/components/Header";
import PricingSection from "@/components/PricingSection";
import Footer from "@/components/Footer";

export default function Pricing() {
  const [isAuthenticated] = useState(true);

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        generationsUsed={0}
        maxFreeGenerations={1}
        isAuthenticated={isAuthenticated}
      />
      
      <main className="flex-1">
        <section className="py-20">
          <div className="container mx-auto px-4 text-center space-y-4 mb-12">
            <h1 className="text-4xl md:text-5xl font-display font-bold">
              Simple, Transparent Pricing
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Start free, upgrade when you need more. No hidden fees, cancel anytime.
            </p>
          </div>
        </section>
        
        <PricingSection />
      </main>

      <Footer />
    </div>
  );
}
