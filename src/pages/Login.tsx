import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Coins, Eye, EyeOff, Mail, Lock, ArrowRight, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [adminError, setAdminError] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setAdminError(false);

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === "email") fieldErrors.email = err.message;
        if (err.path[0] === "password") fieldErrors.password = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Sign in first. We need a valid session before we can query roles.
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        toast({
          variant: "destructive",
          title: "Sign in failed",
          description: signInError.message,
        });
        setIsLoading(false);
        return;
      }

      // Step 2: Check if this user is an admin or moderator.
      // Both roles are blocked from the regular panel — they must use the admin panel.
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", signInData.user.id)
        .in("role", ["admin", "moderator"])
        .maybeSingle();

      if (roleData) {
        // Admin or moderator detected — sign out and show the admin panel redirect.
        await supabase.auth.signOut();
        setIsLoading(false);
        setAdminError(true);
        return;
      }

      // Step 3: Safety net — if the auth trigger never created a profile,
      // call ensure_profile_on_login to create one now.
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", signInData.user.id)
        .maybeSingle();

      if (!profile) {
        // Create profile directly if missing (fallback when trigger didn't fire)
        const randomEmojis = ["🎵", "🎶", "🎤", "🎧", "🌟", "⭐", "🔥", "💫", "✨", "🎯"];
        const randomAvatar = randomEmojis[Math.floor(Math.random() * randomEmojis.length)];
        const referralCode = `TIK${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        
        await supabase.from("profiles").insert({
          user_id: signInData.user.id,
          email: signInData.user.email || "",
          tiktok_username: signInData.user.user_metadata?.tiktok_username || "",
          avatar_url: randomAvatar,
          referral_code: referralCode,
          tik_points: 0
        });
      }

      toast({
        title: "Welcome back!",
        description: "You have successfully signed in.",
      });

      setIsLoading(false);
      navigate("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      toast({
        variant: "destructive",
        title: "Sign in failed",
        description: "An error occurred. Please try again.",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-background pointer-events-none" />
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(ellipse at 30% 20%, hsl(330 90% 60% / 0.15) 0%, transparent 50%),
                            radial-gradient(ellipse at 70% 80%, hsl(180 80% 50% / 0.1) 0%, transparent 40%)`,
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Coins className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold">TrendUp</span>
        </Link>

        <Card variant="glass">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Welcome Back</CardTitle>
            <CardDescription>Sign in to your account to continue</CardDescription>
          </CardHeader>
          <CardContent>
            {adminError ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-destructive mb-1">Admin Account Detected</h3>
                      <p className="text-sm text-muted-foreground">
                        This account has administrative privileges. Please use the admin panel to log in securely.
                      </p>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/baki/stage/admin/login")}
                >
                  Go to Admin Login
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setAdminError(false);
                    setEmail("");
                    setPassword("");
                  }}
                >
                  Use Different Account
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      className="pl-10"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      className="pl-10 pr-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>

                <Button variant="gradient" className="w-full" size="lg" type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Don't have an account?{" "}
                  <Link to="/register" className="text-primary hover:underline font-medium">
                    Sign up
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
