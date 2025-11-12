import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import PaletteGenerator from "@/components/PaletteGenerator";
import FeaturesSection from "@/components/FeaturesSection";
import PricingSection from "@/components/PricingSection";
import Footer from "@/components/Footer";
import PaywallModal from "@/components/PaywallModal";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

interface UserStatus {
  totalGenerations: number;
  monthlyGenerations: number;
  remainingGenerations: number;
  hasSubscription: boolean;
  subscriptionStatus: string | null;
  isUnlimited: boolean;
}

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showPaywall, setShowPaywall] = useState(false);
  const [currentPalette, setCurrentPalette] = useState<any[]>([]);

  // Get user status
  const { data: userStatus, refetch: refetchStatus } = useQuery<UserStatus>({
    queryKey: ["/api/user/status"],
    enabled: isAuthenticated,
  });

  // Generate palette mutation
  const generateMutation = useMutation({
    mutationFn: async (palette: any) => {
      const res = await apiRequest("POST", "/api/generate", {
        palette,
        harmony: "complementary",
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Palette Generated!",
        description: "Your color palette has been created successfully.",
      });
      refetchStatus();
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      if (error.message.includes("No generations remaining")) {
        setShowPaywall(true);
      } else {
        toast({
          title: "Error",
          description: "Failed to generate palette. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  // Create checkout session mutation
  const checkoutMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const res = await apiRequest("POST", "/api/checkout", { priceId });
      return await res.json();
    },
    onSuccess: (data: any) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      toast({
        title: "Error",
        description: "Failed to create checkout session. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = (palette?: any) => {
    const paletteData = palette || currentPalette;
    
    if (!userStatus) return;
    
    // Block if user has no remaining generations (unless unlimited)
    if (!userStatus.isUnlimited && userStatus.remainingGenerations <= 0) {
      setShowPaywall(true);
      return;
    }
    
    setCurrentPalette(paletteData);
    generateMutation.mutate(paletteData);
  };

  const handleSelectPlan = (planName: string) => {
    // Map plan names to price IDs (subscription only)
    const priceMap: Record<string, string> = {
      "Free": "",
      "Pro": import.meta.env.VITE_STRIPE_PRICE_PRO || "price_pro",
      "Unlimited": import.meta.env.VITE_STRIPE_PRICE_UNLIMITED || "price_unlimited",
    };
    
    const priceId = priceMap[planName];
    if (priceId) {
      checkoutMutation.mutate(priceId);
    }
  };

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const canGenerate = userStatus && (userStatus.isUnlimited || userStatus.remainingGenerations > 0);

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        generationsUsed={userStatus?.totalGenerations || 0}
        maxFreeGenerations={1}
        isAuthenticated={isAuthenticated}
        onLogout={handleLogout}
      />
      
      <main className="flex-1">
        <Hero onGenerateFree={() => handleGenerate()} />
        <PaletteGenerator 
          onGenerate={handleGenerate}
          disabled={!canGenerate}
        />
        <FeaturesSection />
        <PricingSection onSelectPlan={handleSelectPlan} />
      </main>

      <Footer />

      <PaywallModal
        open={showPaywall}
        onOpenChange={setShowPaywall}
        onSelectPlan={handleSelectPlan}
      />
    </div>
  );
}
