import { useState } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import PaletteGenerator from "@/components/PaletteGenerator";
import FeaturesSection from "@/components/FeaturesSection";
import PricingSection from "@/components/PricingSection";
import Footer from "@/components/Footer";
import PaywallModal from "@/components/PaywallModal";

export default function Home() {
  const [generationsUsed, setGenerationsUsed] = useState(0);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(true);

  const handleGenerate = () => {
    if (generationsUsed >= 1) {
      setShowPaywall(true);
    } else {
      setGenerationsUsed(prev => prev + 1);
    }
  };

  const handleLogin = () => {
    console.log('Login clicked');
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    console.log('Logout clicked');
    setIsAuthenticated(false);
    setGenerationsUsed(0);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        generationsUsed={generationsUsed}
        maxFreeGenerations={1}
        isAuthenticated={isAuthenticated}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />
      
      <main className="flex-1">
        <Hero onGenerateFree={handleGenerate} />
        <PaletteGenerator 
          onGenerate={handleGenerate}
          disabled={generationsUsed >= 1}
        />
        <FeaturesSection />
        <PricingSection />
      </main>

      <Footer />

      <PaywallModal
        open={showPaywall}
        onOpenChange={setShowPaywall}
      />
    </div>
  );
}
