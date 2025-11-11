import { useMutation } from "@tanstack/react-query";
import Header from "@/components/Header";
import PricingSection from "@/components/PricingSection";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function Pricing() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

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

  const handleSelectPlan = (planName: string) => {
    if (!isAuthenticated) {
      window.location.href = "/api/login";
      return;
    }

    // Map plan names to price IDs
    const priceMap: Record<string, string> = {
      "Free": "",
      "Pro": process.env.VITE_STRIPE_PRICE_PRO || "price_pro",
      "Unlimited": process.env.VITE_STRIPE_PRICE_UNLIMITED || "price_unlimited",
    };
    
    const priceId = priceMap[planName];
    if (priceId) {
      checkoutMutation.mutate(priceId);
    }
  };

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        isAuthenticated={isAuthenticated}
        onLogout={handleLogout}
        onLogin={() => window.location.href = "/api/login"}
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
        
        <PricingSection onSelectPlan={handleSelectPlan} />
      </main>

      <Footer />
    </div>
  );
}
