import { Card } from "@/components/ui/card";
import { Palette, Lock, Download, Zap, Share2, Code } from "lucide-react";

const features = [
  {
    icon: Palette,
    title: "Smart Color Harmonies",
    description: "Choose from complementary, analogous, triadic, and monochromatic color schemes",
  },
  {
    icon: Lock,
    title: "Lock Colors",
    description: "Preserve colors you love while generating new variations for the rest",
  },
  {
    icon: Download,
    title: "Multiple Export Formats",
    description: "Export palettes as CSS, PNG, or JSON for easy integration",
  },
  {
    icon: Zap,
    title: "Instant Generation",
    description: "Generate beautiful palettes in milliseconds with our optimized algorithm",
  },
  {
    icon: Share2,
    title: "Easy Sharing",
    description: "Copy hex codes with one click or share entire palettes with your team",
  },
  {
    icon: Code,
    title: "Developer Friendly",
    description: "API access for pro users to integrate palette generation into your workflow",
  },
];

export default function FeaturesSection() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl md:text-4xl font-display font-bold">
            Everything You Need
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Powerful features to help designers and developers create perfect color schemes
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <Card
                key={i}
                className="p-6 space-y-3 hover-elevate"
                data-testid={`card-feature-${i}`}
              >
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-display font-semibold">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
