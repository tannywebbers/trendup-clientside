import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Coins, Calculator, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { FaTiktok } from "react-icons/fa";

interface PricingSettings {
  points_amount: number;
  currency_amount: number;
  currency_symbol: string;
}

function PaystackLogo({ className = "h-5" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <circle cx="12" cy="12" r="12" fill="#1b8d4e" />
        <text x="12" y="17" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700" fontFamily="Arial, sans-serif">P</text>
      </svg>
    </span>
  );
}

export function PricingSection() {
  const [selectedPoints, setSelectedPoints] = useState<number>(100);
  const [pricing, setPricing] = useState<PricingSettings>({
    points_amount: 10,
    currency_amount: 5,
    currency_symbol: "₦",
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const { data, error } = await supabase
          .from("platform_settings")
          .select("value")
          .eq("key", "pricing_settings")
          .maybeSingle();

        if (!error && data?.value) {
          const settings = data.value as unknown as PricingSettings;
          setPricing(settings);
        }
      } catch (err) {
        console.error("Error fetching pricing:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPricing();
  }, []);

  // Calculate price based on selected points
  const calculatePrice = (points: number) => {
    const pricePerPoint = pricing.currency_amount / pricing.points_amount;
    return (points * pricePerPoint).toFixed(2);
  };

  // Quick select options
  const quickOptions = [50, 100, 250, 500, 1000, 2500];

  return (
    <section className="py-24 relative" id="pricing">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Simple <span className="gradient-text">Pricing</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Purchase Streak Points instantly. Slide to select your amount.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto"
        >
          <Card variant="elevated" className="border-primary/30">
            <CardHeader className="text-center pb-2">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4">
                <Calculator className="w-8 h-8 text-primary-foreground" />
              </div>
              <CardTitle className="text-2xl">Streak Points Calculator</CardTitle>
              <p className="text-muted-foreground text-sm">
                {pricing.points_amount} points = {pricing.currency_symbol}{pricing.currency_amount}
              </p>
            </CardHeader>

            <CardContent className="space-y-8">
              {/* Main display */}
              <div className="text-center py-6 px-4 rounded-2xl bg-gradient-to-br from-primary/10 via-purple-500/5 to-accent/10 border border-primary/20">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <Coins className="w-8 h-8 text-primary" />
                  <span className="text-5xl md:text-6xl font-bold gradient-text">
                    {selectedPoints.toLocaleString()}
                  </span>
                </div>
                <p className="text-muted-foreground">Streak Points</p>

                <div className="mt-4 pt-4 border-t border-border/50">
                  <span className="text-3xl md:text-4xl font-bold">
                    {pricing.currency_symbol}{calculatePrice(selectedPoints)}
                  </span>
                </div>
              </div>

              {/* Slider */}
              <div className="px-2">
                <Slider
                  value={[selectedPoints]}
                  onValueChange={(value) => setSelectedPoints(value[0])}
                  min={10}
                  max={5000}
                  step={10}
                  className="py-4"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>10 pts</span>
                  <span>5,000 pts</span>
                </div>
              </div>

              {/* Quick select buttons */}
              <div className="grid grid-cols-3 gap-2">
                {quickOptions.map((points) => (
                  <Button
                    key={points}
                    variant={selectedPoints === points ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedPoints(points)}
                    className={selectedPoints === points ? "bg-primary" : ""}
                  >
                    {points.toLocaleString()} pts
                  </Button>
                ))}
              </div>

              {/* CTA Button */}
              <Button variant="gradient" size="xl" className="w-full" asChild>
                <Link to="/register">
                  Buy {selectedPoints.toLocaleString()} Streak Points for {pricing.currency_symbol}{calculatePrice(selectedPoints)}
                </Link>
              </Button>

              {/* Paystack secured badge */}
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="w-4 h-4 text-success" />
                <span>Secured by</span>
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <PaystackLogo /> Paystack
                </span>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Payments are processed securely by Paystack. Streak Points are credited instantly.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}