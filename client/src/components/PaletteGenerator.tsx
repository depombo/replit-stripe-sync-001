import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Lock, Unlock, RefreshCw, Download, FileCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Color {
  hex: string;
  locked: boolean;
}

interface PaletteGeneratorProps {
  onGenerate?: () => void;
  disabled?: boolean;
}

const harmonies = [
  { value: "complementary", label: "Complementary" },
  { value: "analogous", label: "Analogous" },
  { value: "triadic", label: "Triadic" },
  { value: "monochromatic", label: "Monochromatic" },
];

function generateRandomColor(): string {
  return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
}

export default function PaletteGenerator({ 
  onGenerate = () => console.log('Generate palette'),
  disabled = false 
}: PaletteGeneratorProps) {
  const { toast } = useToast();
  const [harmony, setHarmony] = useState("complementary");
  const [colors, setColors] = useState<Color[]>([
    { hex: '#667eea', locked: false },
    { hex: '#764ba2', locked: false },
    { hex: '#f093fb', locked: false },
    { hex: '#4facfe', locked: false },
    { hex: '#43e97b', locked: false },
  ]);

  const generatePalette = () => {
    onGenerate();
    setColors(prev => prev.map(color => 
      color.locked ? color : { ...color, hex: generateRandomColor() }
    ));
  };

  const toggleLock = (index: number) => {
    setColors(prev => prev.map((color, i) => 
      i === index ? { ...color, locked: !color.locked } : color
    ));
  };

  const copyHex = (hex: string) => {
    navigator.clipboard.writeText(hex);
    toast({
      title: "Copied!",
      description: `${hex} copied to clipboard`,
    });
  };

  const exportCSS = () => {
    const css = colors.map((c, i) => `  --color-${i + 1}: ${c.hex};`).join('\n');
    navigator.clipboard.writeText(`:root {\n${css}\n}`);
    toast({
      title: "CSS Exported!",
      description: "Copied to clipboard",
    });
  };

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <Card className="p-6 md:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-display font-bold">Color Palette</h2>
              <p className="text-sm text-muted-foreground">Click colors to copy, lock to preserve</p>
            </div>
            
            <div className="flex items-center gap-3">
              <Select value={harmony} onValueChange={setHarmony}>
                <SelectTrigger className="w-40" data-testid="select-harmony">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {harmonies.map(h => (
                    <SelectItem key={h.value} value={h.value}>
                      {h.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {colors.map((color, index) => (
              <div
                key={index}
                className="group relative aspect-square rounded-lg overflow-hidden shadow-lg transition-transform hover:scale-105"
                style={{ backgroundColor: color.hex }}
                data-testid={`color-swatch-${index}`}
              >
                <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors">
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => copyHex(color.hex)}
                        className="font-mono text-xs text-white hover-elevate rounded px-2 py-1"
                        data-testid={`button-copy-${index}`}
                      >
                        {color.hex}
                      </button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-white hover:text-white"
                        onClick={() => toggleLock(index)}
                        data-testid={`button-lock-${index}`}
                      >
                        {color.locked ? (
                          <Lock className="h-4 w-4" />
                        ) : (
                          <Unlock className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="lg"
              onClick={generatePalette}
              disabled={disabled}
              data-testid="button-generate-palette"
            >
              <RefreshCw className="mr-2 h-5 w-5" />
              Generate New Palette
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={exportCSS}
              data-testid="button-export-css"
            >
              <FileCode className="mr-2 h-5 w-5" />
              Export CSS
            </Button>
          </div>
        </Card>
      </div>
    </section>
  );
}
