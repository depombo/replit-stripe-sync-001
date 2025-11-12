import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Zap, Infinity, ShoppingBag } from "lucide-react";

interface PricingSectionProps {
  onSelectPlan?: (plan: string) => void;
}

const pricingTiers = [
  {
    name: "Free",
    price: "$0",
    description: "Perfect to try it out",
    features: [
      "1 free color palette",
      "All harmony modes",
      "Copy hex codes",
      "Export as CSS",
    ],
    cta: "Get Started",
    icon: Sparkles,
    highlighted: false,
  },
  {
    name: "Credit Pack",
    price: "$4.99",
    description: "10 generations",
    features: [
      "10 color palettes",
      "No expiration",
      "Use at your own pace",
      "All harmony modes",
      "Export as CSS/PNG",
    ],
    cta: "Buy Credits",
    icon: ShoppingBag,
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$9.99",
    period: "/month",
    description: "For regular creators",
    features: [
      "100 palettes per month",
      "Save favorite palettes",
      "Advanced harmonies",
      "Export as PNG",
      "Priority support",
    ],
    cta: "Start Pro",
    icon: Zap,
    highlighted: true,
  },
  {
    name: "Unlimited",
    price: "$19.99",
    period: "/month",
    description: "For power users",
    features: [
      "Unlimited palettes",
      "Save unlimited favorites",
      "API access",
      "Team sharing",
      "Custom exports",
      "Dedicated support",
    ],
    cta: "Go Unlimited",
    icon: Infinity,
    highlighted: false,
  },
];

export default function PricingSection({ onSelectPlan = (plan) => console.log(`Selected: ${plan}`) }: PricingSectionProps) {
  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl md:text-4xl font-display font-bold">
            Choose Your Plan
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start with one free palette, then upgrade when you're ready for more
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          {pricingTiers.map((tier) => {
            const Icon = tier.icon;
            return (
              <Card
                key={tier.name}
                className={`p-8 space-y-6 relative ${
                  tier.highlighted
                    ? 'border-primary border-2 shadow-lg scale-105'
                    : ''
                }`}
                data-testid={`card-pricing-${tier.name.toLowerCase()}`}
              >
                {tier.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-4 py-1.5 rounded-full shadow-md">
                      MOST POPULAR
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-6 w-6 text-primary" />
                    <h3 className="text-xl font-display font-bold">{tier.name}</h3>
                  </div>
                  
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{tier.price}</span>
                    {tier.period && (
                      <span className="text-muted-foreground">{tier.period}</span>
                    )}
                  </div>
                  
                  <p className="text-sm text-muted-foreground">{tier.description}</p>
                </div>

                <ul className="space-y-3">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={tier.highlighted ? "default" : "outline"}
                  size="lg"
                  onClick={() => onSelectPlan(tier.name)}
                  data-testid={`button-pricing-${tier.name.toLowerCase()}`}
                >
                  {tier.cta}
                </Button>
              </Card>
            );
          })}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-12">
          All plans include a 7-day money-back guarantee • No credit card required for free tier
        </p>
      </div>
    </section>
  );
}
