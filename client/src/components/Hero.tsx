import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface HeroProps {
  onGenerateFree?: () => void;
}

export default function Hero({ onGenerateFree = () => console.log('Generate clicked') }: HeroProps) {
  return (
    <section className="relative overflow-hidden py-20 md:py-32">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="mx-auto max-w-4xl text-center space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border bg-muted px-4 py-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-medium">One free generation to get started</span>
          </div>

          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight">
            Create Beautiful{" "}
            <span className="bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">
              Color Palettes
            </span>{" "}
            in Seconds
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Generate stunning color schemes with our intelligent algorithm. Try one free palette, then unlock unlimited creativity.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              className="text-base px-8"
              onClick={onGenerateFree}
              data-testid="button-generate-free"
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Generate Free Palette
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-base px-8"
              data-testid="button-view-pricing"
            >
              View Pricing
            </Button>
          </div>

          <div className="pt-8 flex gap-2 justify-center flex-wrap">
            {['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b'].map((color, i) => (
              <div
                key={i}
                className="h-16 w-16 md:h-20 md:w-20 rounded-lg shadow-lg transition-transform hover:scale-105"
                style={{ backgroundColor: color }}
                data-testid={`color-preview-${i}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
