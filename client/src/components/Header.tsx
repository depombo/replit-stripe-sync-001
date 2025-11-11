import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Palette, Moon, Sun } from "lucide-react";
import { useState, useEffect } from "react";

interface HeaderProps {
  generationsUsed?: number;
  maxFreeGenerations?: number;
  isAuthenticated?: boolean;
  onLogin?: () => void;
  onLogout?: () => void;
}

export default function Header({
  generationsUsed = 0,
  maxFreeGenerations = 1,
  isAuthenticated = false,
  onLogin = () => console.log('Login clicked'),
  onLogout = () => console.log('Logout clicked'),
}: HeaderProps) {
  const [location] = useLocation();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    if (newIsDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" data-testid="link-home">
            <a className="flex items-center gap-2 hover-elevate rounded-md px-2 py-1 -mx-2">
              <Palette className="h-6 w-6 text-primary" />
              <span className="font-display text-xl font-bold">PaletteForge</span>
            </a>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link href="/" data-testid="link-nav-home">
              <a className={`text-sm font-medium transition-colors hover:text-primary ${location === '/' ? 'text-foreground' : 'text-muted-foreground'}`}>
                Home
              </a>
            </Link>
            <Link href="/pricing" data-testid="link-nav-pricing">
              <a className={`text-sm font-medium transition-colors hover:text-primary ${location === '/pricing' ? 'text-foreground' : 'text-muted-foreground'}`}>
                Pricing
              </a>
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {isAuthenticated && (
            <Badge variant="secondary" className="hidden sm:flex" data-testid="badge-generation-count">
              {generationsUsed}/{maxFreeGenerations} free
            </Badge>
          )}

          <Button
            size="icon"
            variant="ghost"
            onClick={toggleTheme}
            data-testid="button-theme-toggle"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          {isAuthenticated ? (
            <Button variant="outline" onClick={onLogout} data-testid="button-logout">
              Logout
            </Button>
          ) : (
            <Button onClick={onLogin} data-testid="button-login">
              Sign In
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
