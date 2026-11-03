import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { KeyRound, Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";

const MAX_ATTEMPTS = 3;
const PENDING_TIMEOUT = 5 * 60 * 1000; // 5 minutes

interface Pending2FAData {
  userId: string;
  email: string;
  password: string;
  timestamp: number;
}

export default function AdminVerify2FA() {
  const [totpCode, setTotpCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockUntil, setLockUntil] = useState<Date | null>(null);
  const [pendingData, setPendingData] = useState<Pending2FAData | null>(null);
  
  const navigate = useNavigate();

  useEffect(() => {
    // Check for pending 2FA data
    const pending = sessionStorage.getItem("admin_2fa_pending");
    if (!pending) {
      navigate("/baki/stage/admin/login");
      return;
    }

    try {
      const data: Pending2FAData = JSON.parse(pending);
      
      // Check if pending data has expired
      if (Date.now() - data.timestamp > PENDING_TIMEOUT) {
        sessionStorage.removeItem("admin_2fa_pending");
        navigate("/baki/stage/admin/login");
        return;
      }

      setPendingData(data);
      
      // Check lockout status
      checkLockout(data.userId);
    } catch {
      sessionStorage.removeItem("admin_2fa_pending");
      navigate("/baki/stage/admin/login");
    }
  }, [navigate]);

  const checkLockout = async (userId: string) => {
    const { data: totpData } = await supabase.functions.invoke("totp-verify", {
      body: { user_id: userId, action: "check_lockout" },
    });
    
    if (totpData?.locked) {
      setIsLocked(true);
      setLockUntil(new Date(totpData.locked_until));
    }
    setFailedAttempts(totpData?.failed_attempts || 0);
  };

  const handleVerify = async () => {
    if ((totpCode.length !== 6 && totpCode.length !== 8) || !pendingData) return;

    setIsVerifying(true);
    setError("");

    try {
      const { data, error: verifyError } = await supabase.functions.invoke("totp-verify", {
        body: { 
          user_id: pendingData.userId, 
          code: totpCode,
          action: "login_verify"
        },
      });

      if (verifyError || !data?.success) {
        // Handle lockout
        if (data?.locked) {
          setIsLocked(true);
          setLockUntil(new Date(data.locked_until));
          setError("");
        } else {
          const newAttempts = data?.failed_attempts || failedAttempts + 1;
          setFailedAttempts(newAttempts);
          const remaining = MAX_ATTEMPTS - newAttempts;
          setError(
            remaining > 0 
              ? `Invalid code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
              : "Account locked. Try again later."
          );
        }
        setIsVerifying(false);
        setTotpCode("");
        return;
      }

      // 2FA verified successfully - now complete the actual authentication
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: pendingData.email,
        password: pendingData.password,
      });

      if (signInError) {
        setError("Authentication failed. Please start over.");
        setIsVerifying(false);
        return;
      }

      // Clear pending state and log success
      sessionStorage.removeItem("admin_2fa_pending");
      
      await supabase.functions.invoke("admin-login", {
        body: { 
          action: "log_success",
          email: pendingData.email,
          with2FA: true
        },
      });

      navigate("/baki/stage/admin");
    } catch (err) {
      console.error("Verification error:", err);
      setError("Verification failed. Please try again.");
      setIsVerifying(false);
    }
  };

  const handleBack = () => {
    sessionStorage.removeItem("admin_2fa_pending");
    navigate("/baki/stage/admin/login");
  };

  const formatLockTime = () => {
    if (!lockUntil) return "";
    const now = new Date();
    const diff = lockUntil.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  if (!pendingData) {
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
            {isLocked ? (
              <AlertTriangle className="w-8 h-8 text-red-400" />
            ) : (
              <KeyRound className="w-8 h-8 text-neutral-300" />
            )}
          </div>
          <h1 className="text-xl font-semibold text-neutral-100">
            {isLocked ? "Account Locked" : "Two-Factor Authentication"}
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            {isLocked 
              ? `Try again in ${formatLockTime()}`
              : "Enter your 6-digit code or backup code"
            }
          </p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          {isLocked ? (
            <div className="space-y-6 text-center">
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-400">
                  Too many failed attempts. Your account has been temporarily locked for security.
                </p>
              </div>
              <Button
                variant="ghost"
                className="w-full text-neutral-400"
                onClick={handleBack}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Login
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={8}
                  value={totpCode}
                  onChange={(value) => setTotpCode(value)}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="bg-neutral-800 border-neutral-700 text-neutral-100" />
                    <InputOTPSlot index={1} className="bg-neutral-800 border-neutral-700 text-neutral-100" />
                    <InputOTPSlot index={2} className="bg-neutral-800 border-neutral-700 text-neutral-100" />
                    <InputOTPSlot index={3} className="bg-neutral-800 border-neutral-700 text-neutral-100" />
                    <InputOTPSlot index={4} className="bg-neutral-800 border-neutral-700 text-neutral-100" />
                    <InputOTPSlot index={5} className="bg-neutral-800 border-neutral-700 text-neutral-100" />
                    <InputOTPSlot index={6} className="bg-neutral-800 border-neutral-700 text-neutral-100 hidden" />
                    <InputOTPSlot index={7} className="bg-neutral-800 border-neutral-700 text-neutral-100 hidden" />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <p className="text-sm text-neutral-500 text-center">
                Enter the 6-digit code from your authenticator app, or an 8-character backup code
              </p>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <Button
                className="w-full bg-neutral-100 text-neutral-900 hover:bg-neutral-200"
                disabled={(totpCode.length !== 6 && totpCode.length !== 8) || isVerifying}
                onClick={handleVerify}
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Verifying...
                  </>
                ) : (
                  "Verify & Continue"
                )}
              </Button>

              <Button
                variant="ghost"
                className="w-full text-neutral-400"
                onClick={handleBack}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Login
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
