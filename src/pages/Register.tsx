import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Coins, 
  Eye, 
  EyeOff, 
  Mail, 
  Lock, 
  AtSign,
  ArrowRight,
  AlertTriangle,
  Loader2,
  MapPin,
  ShieldCheck,
  Gift
} from "lucide-react";
import { getCountryFromIP } from "@/hooks/use-geolocation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email"),
  tiktokUsername: z.string().min(2, "TikTok username must be at least 2 characters").regex(/^[a-zA-Z0-9_.]+$/, "Username can only contain letters, numbers, underscores, and dots"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-z]/, "Must include a lowercase letter")
    .regex(/[A-Z]/, "Must include an uppercase letter")
    .regex(/[0-9]/, "Must include a number"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
  terms: z.literal(true, { errorMap: () => ({ message: "You must accept the terms" }) }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export default function Register() {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    tiktokUsername: "",
    password: "",
    confirmPassword: "",
    referralCode: "",
    terms: false,
  });

  const getPasswordStrength = (pw: string): { score: number; label: string; color: string } => {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    const labels = [
      { label: "Too weak", color: "bg-red-500" },
      { label: "Weak", color: "bg-orange-500" },
      { label: "Fair", color: "bg-yellow-500" },
      { label: "Good", color: "bg-emerald-500" },
      { label: "Strong", color: "bg-green-500" },
    ];
    const textColors = ["text-red-500", "text-orange-500", "text-yellow-500", "text-emerald-500", "text-green-500"];
    return { score, label: labels[score].label, color: textColors[score] };
  };
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null);
  const [detectingCountry, setDetectingCountry] = useState(true);
  
  // Email verification state
  const [emailVerificationEnabled, setEmailVerificationEnabled] = useState(false);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [showOTPInput, setShowOTPInput] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [generatedOTP, setGeneratedOTP] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [referralEnabled, setReferralEnabled] = useState(false);
  
  const { signUp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Get referral code from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    if (ref) {
      setFormData(prev => ({ ...prev, referralCode: ref.toUpperCase() }));
    }
  }, []);

  // Fetch settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      // Get country
      getCountryFromIP().then(country => {
        setDetectedCountry(country);
        setDetectingCountry(false);
      });

      // Check if email verification is enabled
      const { data: emailSettings } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "email_verification")
        .maybeSingle();

      if (emailSettings?.value) {
        const settings = emailSettings.value as { enabled: boolean };
        setEmailVerificationEnabled(settings.enabled || false);
      }

      // Check if SMTP is configured
      const { data: smtpData } = await supabase
        .from("smtp_config")
        .select("is_enabled")
        .eq("is_enabled", true)
        .maybeSingle();

      setSmtpConfigured(!!smtpData);

      // Get allowed email domains
      const { data: domains } = await supabase
        .from("allowed_email_domains")
        .select("domain")
        .eq("is_enabled", true);

      if (domains && domains.length > 0) {
        setAllowedDomains(domains.map(d => d.domain));
      }

      // Check if referral is enabled
      const { data: bonusSettings } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "bonus_settings")
        .maybeSingle();

      if (bonusSettings?.value) {
        const bonus = bonusSettings.value as { referral_enabled?: boolean };
        setReferralEnabled(bonus.referral_enabled ?? false);
      }
    };

    fetchSettings();
  }, []);

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateEmail = (email: string) => {
    if (allowedDomains.length === 0) return true;
    const domain = email.split("@")[1]?.toLowerCase();
    return allowedDomains.includes(domain);
  };

  const sendVerificationEmail = async () => {
    try {
      const response = await supabase.functions.invoke('send-verification-email', {
        body: { 
          email: formData.email, 
          type: 'code' 
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to send verification email');
      }

      toast({
        title: "Verification Code Sent",
        description: `A verification code has been sent to ${formData.email}. Please check your inbox.`,
      });
      return true;
    } catch (error) {
      console.error('Error sending verification email:', error);
      toast({
        variant: "destructive",
        title: "Failed to send verification email",
        description: error instanceof Error ? error.message : "Please try again.",
      });
      return false;
    }
  };

  const verifyCode = async (code: string): Promise<boolean> => {
    try {
      // Check the code against the database
      const { data, error } = await supabase
        .from('email_verifications')
        .select('*')
        .eq('email', formData.email)
        .eq('code', code)
        .eq('verification_type', 'code')
        .is('verified_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error verifying code:', error);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate email domain
    if (!validateEmail(formData.email)) {
      setErrors({ email: `Please use an allowed email provider: ${allowedDomains.join(", ")}` });
      return;
    }

    const result = registerSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    // If email verification is enabled and SMTP is configured
    if (emailVerificationEnabled && smtpConfigured && !showOTPInput) {
      setIsSendingCode(true);
      const sent = await sendVerificationEmail();
      setIsSendingCode(false);
      if (sent) {
        setShowOTPInput(true);
      }
      return;
    }

    // If showing OTP input, verify it first
    if (showOTPInput) {
      const isValid = await verifyCode(otpValue);
      if (!isValid) {
        toast({
          variant: "destructive",
          title: "Invalid verification code",
          description: "Please enter the correct code sent to your email.",
        });
        return;
      }
    }

    setIsLoading(true);
    const { error } = await signUp(formData.email, formData.password, {
      first_name: formData.firstName,
      last_name: formData.lastName,
      tiktok_username: formData.tiktokUsername,
      country: detectedCountry,
      referral_code: formData.referralCode || undefined,
    });
    setIsLoading(false);

    if (!error) {
      navigate("/dashboard");
    }
  };

  const handleVerifyOTP = async () => {
    setIsVerifying(true);
    const isValid = await verifyCode(otpValue);
    
    if (!isValid) {
      setIsVerifying(false);
      toast({
        variant: "destructive",
        title: "Invalid verification code",
        description: "Please enter the correct code sent to your email or it may have expired.",
      });
      return;
    }

    const { error } = await signUp(formData.email, formData.password, {
      first_name: formData.firstName,
      last_name: formData.lastName,
      tiktok_username: formData.tiktokUsername,
      country: detectedCountry,
      referral_code: formData.referralCode || undefined,
    });
    setIsVerifying(false);

    if (!error) {
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background - pointer-events-none to prevent click blocking */}
      <div className="absolute inset-0 bg-background pointer-events-none" />
      <div 
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(ellipse at 70% 20%, hsl(330 90% 60% / 0.15) 0%, transparent 50%),
                            radial-gradient(ellipse at 30% 80%, hsl(180 80% 50% / 0.1) 0%, transparent 40%)`
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
            <CardTitle className="text-2xl">
              {showOTPInput ? "Verify Your Email" : "Create Account"}
            </CardTitle>
            <CardDescription>
              {showOTPInput 
                ? `Enter the 6-digit code sent to ${formData.email}` 
                : "Join TrendUp and start growing today"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {showOTPInput ? (
              <div className="space-y-6">
                <div className="flex justify-center">
                  <ShieldCheck className="w-16 h-16 text-primary" />
                </div>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otpValue} onChange={setOtpValue}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button 
                  variant="gradient" 
                  className="w-full" 
                  size="lg" 
                  onClick={handleVerifyOTP}
                  disabled={otpValue.length !== 6 || isVerifying}
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      Verify & Create Account
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full" 
                  onClick={() => setShowOTPInput(false)}
                >
                  Back to Registration
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input 
                      id="firstName" 
                      placeholder="John"
                      value={formData.firstName}
                      onChange={(e) => handleChange("firstName", e.target.value)}
                    />
                    {errors.firstName && <p className="text-xs text-destructive">{errors.firstName}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input 
                      id="lastName" 
                      placeholder="Doe"
                      value={formData.lastName}
                      onChange={(e) => handleChange("lastName", e.target.value)}
                    />
                    {errors.lastName && <p className="text-xs text-destructive">{errors.lastName}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="you@example.com"
                      className="pl-10"
                      value={formData.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                    />
                  </div>
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>

                {/* TikTok Username - CRITICAL */}
                <div className="space-y-2">
                  <Label htmlFor="tiktok" className="flex items-center gap-2">
                    TikTok Username
                    <Badge variant="destructive" className="text-xs">Cannot Change</Badge>
                  </Label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input 
                      id="tiktok" 
                      placeholder="your_tiktok_username"
                      className="pl-10"
                      value={formData.tiktokUsername}
                      onChange={(e) => handleChange("tiktokUsername", e.target.value)}
                    />
                  </div>
                  <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
                    <p className="text-xs text-warning flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        <strong>Important:</strong> Your TikTok username must exactly match your TikTok profile 
                        (e.g. <span className="font-mono">@your_tiktok_username</span>). This is used to verify your 
                        comments and <strong>cannot be changed later</strong>.
                      </span>
                    </p>
                  </div>
                  {errors.tiktokUsername && <p className="text-sm text-destructive">{errors.tiktokUsername}</p>}
                </div>

                {/* Referral Code - Optional */}
                {referralEnabled && (
                  <div className="space-y-2">
                    <Label htmlFor="referralCode" className="flex items-center gap-2">
                      <Gift className="w-4 h-4" />
                      Referral Code (Optional)
                    </Label>
                    <Input 
                      id="referralCode" 
                      placeholder="Enter referral code"
                      value={formData.referralCode}
                      onChange={(e) => handleChange("referralCode", e.target.value.toUpperCase())}
                      maxLength={8}
                    />
                    <p className="text-xs text-muted-foreground">
                      Have a friend's referral code? Enter it to help them earn rewards!
                    </p>
                  </div>
                )}

                {/* Country Detection - Auto */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Country (Auto-detected)
                  </Label>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                    {detectingCountry ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Detecting location...</span>
                      </>
                    ) : detectedCountry ? (
                      <>
                        <span className="text-sm font-medium">{detectedCountry}</span>
                        <span className="text-xs text-muted-foreground">(auto-detected)</span>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">Location could not be detected</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input 
                      id="password" 
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a strong password"
                      className="pl-10 pr-10"
                      value={formData.password}
                      onChange={(e) => handleChange("password", e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {formData.password && (() => {
                    const strength = getPasswordStrength(formData.password);
                    return (
                      <div className="space-y-2">
                        <div className="flex gap-1">
                          {[0, 1, 2, 3].map((i) => (
                            <div
                              key={i}
                              className={`h-1.5 flex-1 rounded-full ${
                                i < strength.score ? strength.color : "bg-muted"
                              }`}
                            />
                          ))}
                        </div>
                        <p className={`text-xs font-medium ${strength.color}`}>
                          Password strength: {strength.label}
                        </p>
                        <ul className="text-xs text-muted-foreground space-y-0.5">
                          <li className={formData.password.length >= 8 ? "text-green-500" : ""}>{formData.password.length >= 8 ? "✓" : "•"} At least 8 characters</li>
                          <li className={/[a-z]/.test(formData.password) && /[A-Z]/.test(formData.password) ? "text-green-500" : ""}>{/[a-z]/.test(formData.password) && /[A-Z]/.test(formData.password) ? "✓" : "•"} Uppercase & lowercase letters</li>
                          <li className={/[0-9]/.test(formData.password) ? "text-green-500" : ""}>{/[0-9]/.test(formData.password) ? "✓" : "•"} At least one number</li>
                          <li className={/[^A-Za-z0-9]/.test(formData.password) ? "text-green-500" : ""}>{/[^A-Za-z0-9]/.test(formData.password) ? "✓" : "•"} At least one symbol</li>
                        </ul>
                      </div>
                    );
                  })()}
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input 
                      id="confirmPassword" 
                      type={showPassword ? "text" : "password"}
                      placeholder="Re-enter your password"
                      className="pl-10 pr-10"
                      value={formData.confirmPassword}
                      onChange={(e) => handleChange("confirmPassword", e.target.value)}
                    />
                  </div>
                  {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
                </div>

                <div className="flex items-start gap-2">
                  <input 
                    type="checkbox" 
                    className="rounded border-border mt-1" 
                    id="terms"
                    checked={formData.terms}
                    onChange={(e) => handleChange("terms", e.target.checked)}
                  />
                  <label htmlFor="terms" className="text-sm text-muted-foreground">
                    I agree to the{" "}
                    <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
                    {" "}and{" "}
                    <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
                  </label>
                </div>
                {errors.terms && <p className="text-sm text-destructive">{errors.terms}</p>}

                <Button variant="gradient" className="w-full" size="lg" type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      {emailVerificationEnabled && smtpConfigured ? "Sending verification..." : "Creating account..."}
                    </>
                  ) : (
                    <>
                      {emailVerificationEnabled && smtpConfigured ? "Verify Email" : "Create Account"}
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link to="/login" className="text-primary hover:underline font-medium">
                    Sign in
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