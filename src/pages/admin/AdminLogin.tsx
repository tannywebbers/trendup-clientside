import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Lock, Mail, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function AdminLogin() {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Check if user is already fully authenticated
  useEffect(() => {
    const checkAuth = async () => {
      if (!authLoading && user && isAdmin) {
        // Check if 2FA is pending in session storage
        const pending2FA = sessionStorage.getItem("admin_2fa_pending");
        if (!pending2FA) {
          navigate("/baki/stage/admin");
        }
      }
    };
    checkAuth();
  }, [user, isAdmin, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setAuthError("");

    const result = loginSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    
    try {
      // Call the admin-login edge function for credential validation and 2FA check
      const { data, error } = await supabase.functions.invoke("admin-login", {
        body: { 
          email: formData.email, 
          password: formData.password 
        },
      });

      if (error) {
        setIsLoading(false);
        setAuthError("Authentication failed");
        return;
      }

      if (!data.success) {
        setIsLoading(false);
        if (data.locked) {
          setAuthError(`Account locked. Try again in ${data.lockTimeRemaining || "a few hours"}.`);
        } else if (data.rateLimited) {
          setAuthError("Too many login attempts. Please wait a moment.");
        } else {
          setAuthError(data.error || "Invalid credentials");
        }
        return;
      }

      // Check if 2FA is required
      if (data.requires2FA) {
        // Store pending 2FA state and user info in session storage
        sessionStorage.setItem("admin_2fa_pending", JSON.stringify({
          userId: data.userId,
          email: formData.email,
          password: formData.password, // Temporarily store to complete auth after 2FA
          timestamp: Date.now()
        }));
        
        setIsLoading(false);
        navigate("/baki/stage/admin/verify-2fa");
        return;
      }

      // No 2FA required - complete authentication
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (signInError) {
        setIsLoading(false);
        setAuthError("Authentication failed");
        return;
      }

      // Log successful login
      await supabase.functions.invoke("admin-login", {
        body: { 
          action: "log_success",
          email: formData.email
        },
      });

      setIsLoading(false);
      navigate("/baki/stage/admin");
    } catch (err) {
      console.error("Login error:", err);
      setIsLoading(false);
      setAuthError("An error occurred. Please try again.");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-neutral-300" />
          </div>
          <h1 className="text-xl font-semibold text-neutral-100">Admin Access</h1>
          <p className="text-sm text-neutral-500 mt-1">Restricted area</p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-neutral-300">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <Input
                  id="email"
                  type="email"
                  className="pl-10 bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-500"
                  placeholder="admin@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={isLoading}
                />
              </div>
              {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-neutral-300">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="pl-10 pr-10 bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-500"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-400">{errors.password}</p>}
            </div>

            {authError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-400">{authError}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-neutral-100 text-neutral-900 hover:bg-neutral-200"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Authenticating...
                </>
              ) : (
                "Access Panel"
              )}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
