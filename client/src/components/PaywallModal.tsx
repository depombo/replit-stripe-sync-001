import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Sparkles, Zap } from "lucide-react";

interface PaywallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPlan?: (plan: string) => void;
}

const plans = [
  {
    name: "Pro",
    price: "$9.99",
    priceLabel: "/month",
    generations: "100 generations/mo",
    features: ["100 color palettes", "Save favorites", "Advanced harmonies", "Priority support"],
    icon: Zap,
    popular: true,
  },
  {
    name: "Unlimited",
    price: "$19.99",
    priceLabel: "/month",
    generations: "Unlimited",
    features: ["Unlimited palettes", "Save unlimited", "API access", "Team sharing"],
    icon: Sparkles,
    popular: false,
  },
];

export default function PaywallModal({ open, onOpenChange, onSelectPlan = (plan) => console.log(`Selected: ${plan}`) }: PaywallModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-paywall">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display font-bold text-center">
            You've Used Your Free Generation
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            Choose a plan to continue creating beautiful color palettes
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-4 mt-6">
          {plans.map((plan) => {
            const Icon = plan.icon;
            return (
              <Card
                key={plan.name}
                className={`p-6 space-y-4 relative ${
                  plan.popular ? 'border-primary border-2' : ''
                }`}
                data-testid={`card-plan-${plan.name.toLowerCase().replace(' ', '-')}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                      RECOMMENDED
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <h3 className="font-display font-bold text-lg">{plan.name}</h3>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    {plan.priceLabel && (
                      <span className="text-muted-foreground text-sm">{plan.priceLabel}</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.generations}</p>
                </div>

                <ul className="space-y-2">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => {
                    onSelectPlan(plan.name);
                    onOpenChange(false);
                  }}
                  data-testid={`button-select-${plan.name.toLowerCase().replace(' ', '-')}`}
                >
                  Continue Creating
                </Button>
              </Card>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Secured by Stripe • Cancel anytime
        </p>
      </DialogContent>
    </Dialog>
  );
}
