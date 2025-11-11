import { Link } from "wouter";
import { Palette } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t bg-muted/30 py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2 md:col-span-1">
            <Link href="/">
              <a className="flex items-center gap-2 mb-4">
                <Palette className="h-6 w-6 text-primary" />
                <span className="font-display text-xl font-bold">PaletteForge</span>
              </a>
            </Link>
            <p className="text-sm text-muted-foreground">
              Create beautiful color palettes in seconds
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Product</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/">
                  <a className="text-muted-foreground hover:text-foreground transition-colors">
                    Features
                  </a>
                </Link>
              </li>
              <li>
                <Link href="/pricing">
                  <a className="text-muted-foreground hover:text-foreground transition-colors">
                    Pricing
                  </a>
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Support</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  Help Center
                </a>
              </li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  Privacy
                </a>
              </li>
              <li>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  Terms
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © 2024 PaletteForge. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="inline-block h-4 w-4 bg-gradient-to-r from-primary to-chart-2 rounded-sm" />
            Secured by Stripe
          </p>
        </div>
      </div>
    </footer>
  );
}
