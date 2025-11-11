import Header from "@/components/Header";
import Hero from "@/components/Hero";
import FeaturesSection from "@/components/FeaturesSection";
import PricingSection from "@/components/PricingSection";
import Footer from "@/components/Footer";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        isAuthenticated={false}
        onLogin={handleLogin}
      />
      
      <main className="flex-1">
        <Hero onGenerateFree={handleLogin} />
        <FeaturesSection />
        <PricingSection onSelectPlan={handleLogin} />
      </main>

      <Footer />
    </div>
  );
}
