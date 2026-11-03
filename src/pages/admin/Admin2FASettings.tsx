import { useState, useEffect } from "react";
import {
  Shield,
  QrCode,
  KeyRound,
  Loader2,
  Copy,
  Check,
  AlertTriangle,
  Smartphone,
  ShieldOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { QRCodeSVG } from "qrcode.react";

export default function Admin2FASettings() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSetup, setIsSetup] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [setupStep, setSetupStep] = useState(1);
  const [setupData, setSetupData] = useState<{
    secret: string;
    otpauthUri: string;
    backupCodes: string[];
  } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  
  const { toast } = useToast();
  const { user, userRole } = useAuth();

  useEffect(() => {
    checkStatus();
  }, [user]);

  const checkStatus = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase.functions.invoke("totp-setup", {
        body: { action: "status" },
      });

      if (!error && data) {
        setIsEnabled(data.enabled);
        setIsSetup(data.setup);
      }
    } catch (err) {
      console.error("Error checking 2FA status:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartSetup = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("totp-setup", {
        body: { action: "setup" },
      });

      if (error) throw error;

      setSetupData({
        secret: data.secret,
        otpauthUri: data.otpauthUri,
        backupCodes: data.backupCodes,
      });
      setSetupStep(1);
      setShowSetupDialog(true);
    } catch (err) {
      console.error("Error starting 2FA setup:", err);
      toast({ variant: "destructive", title: "Error", description: "Failed to initialize 2FA setup." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySetup = async () => {
    if (verifyCode.length !== 6 || !user) return;

    setIsVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("totp-verify", {
        body: { user_id: user.id, code: verifyCode, action: "verify-setup" },
      });

      if (error || !data?.success) {
        toast({ variant: "destructive", title: "Invalid Code", description: "Please check the code and try again." });
        setIsVerifying(false);
        return;
      }

      setSetupStep(3);
      setIsEnabled(true);
      setIsSetup(true);
      toast({ title: "2FA Enabled!", description: "Your account is now protected with two-factor authentication." });
    } catch (err) {
      console.error("Verify error:", err);
      toast({ variant: "destructive", title: "Error", description: "Verification failed." });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDisable2FA = async () => {
    if (disableCode.length < 6 || !user) return;

    setIsDisabling(true);
    try {
      const { data, error } = await supabase.functions.invoke("totp-verify", {
        body: { user_id: user.id, code: disableCode, action: "disable" },
      });

      if (error || !data?.success) {
        toast({ variant: "destructive", title: "Invalid Code", description: "Please enter a valid code to disable 2FA." });
        setIsDisabling(false);
        return;
      }

      setIsEnabled(false);
      setIsSetup(false);
      setShowDisableDialog(false);
      setDisableCode("");
      toast({ title: "2FA Disabled", description: "Two-factor authentication has been disabled for your account." });
    } catch (err) {
      console.error("Disable error:", err);
      toast({ variant: "destructive", title: "Error", description: "Failed to disable 2FA." });
    } finally {
      setIsDisabling(false);
    }
  };

  const copyToClipboard = (text: string, type: "secret" | "codes") => {
    navigator.clipboard.writeText(text);
    if (type === "secret") {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else {
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Two-Factor Authentication</h1>
        <p className="text-sm text-muted-foreground">
          Secure your {userRole === 'moderator' ? 'moderator' : 'admin'} account with TOTP
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-foreground" />
            <span>2FA Status</span>
          </CardTitle>
          <CardDescription>
            Two-factor authentication adds an extra layer of security to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/50">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isEnabled ? "bg-green-500/10" : "bg-muted"}`}>
                <KeyRound className={`w-5 h-5 ${isEnabled ? "text-green-500" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className="font-medium text-foreground">Authenticator App</p>
                <p className="text-sm text-muted-foreground">Google Authenticator, Authy, etc.</p>
              </div>
            </div>
            <Badge variant={isEnabled ? "success" : "secondary"}>
              {isEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>

          {!isEnabled && (
            <div className="p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/10">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-500">Recommended</p>
                  <p className="text-sm text-muted-foreground">
                    Enable 2FA to protect your {userRole === 'moderator' ? 'moderator' : 'admin'} account from unauthorized access.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={handleStartSetup} className="flex-1" disabled={isLoading}>
              {isEnabled ? "Reconfigure 2FA" : "Enable 2FA"}
            </Button>
            {isEnabled && (
              <Button 
                variant="destructive" 
                onClick={() => setShowDisableDialog(true)} 
                disabled={isLoading}
              >
                <ShieldOff className="w-4 h-4 mr-2" />
                Disable
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Setup Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              {setupStep === 1 && "Scan QR Code"}
              {setupStep === 2 && "Verify Setup"}
              {setupStep === 3 && "Backup Codes"}
            </DialogTitle>
            <DialogDescription>
              {setupStep === 1 && "Scan this code with your authenticator app"}
              {setupStep === 2 && "Enter the 6-digit code from your app"}
              {setupStep === 3 && "Save these backup codes in a safe place"}
            </DialogDescription>
          </DialogHeader>

          {setupStep === 1 && setupData && (
            <div className="space-y-4">
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <QRCodeSVG value={setupData.otpauthUri} size={200} />
              </div>

              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Or enter this code manually:
                </p>
                <div className="flex items-center justify-center gap-2">
                  <code className="px-3 py-2 bg-muted rounded text-sm font-mono">
                    {setupData.secret}
                  </code>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => copyToClipboard(setupData.secret, "secret")}
                  >
                    {copiedSecret ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg text-sm">
                <Smartphone className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Recommended apps: Google Authenticator, Authy, 1Password
                </span>
              </div>
            </div>
          )}

          {setupStep === 2 && (
            <div className="space-y-6">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={verifyCode}
                  onChange={(value) => setVerifyCode(value)}
                >
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

              <p className="text-sm text-muted-foreground text-center">
                Enter the 6-digit code shown in your authenticator app
              </p>
            </div>
          )}

          {setupStep === 3 && setupData && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <Label>Backup Codes</Label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(setupData.backupCodes.join("\n"), "codes")}
                  >
                    {copiedCodes ? (
                      <>
                        <Check className="w-4 h-4 mr-1 text-green-500" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-1" />
                        Copy All
                      </>
                    )}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {setupData.backupCodes.map((code, i) => (
                    <code key={i} className="px-2 py-1 bg-background rounded text-xs font-mono">
                      {code}
                    </code>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-sm text-yellow-500">
                  <strong>Important:</strong> Save these codes in a secure location. Each code can only be used once.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            {setupStep === 1 && (
              <Button onClick={() => setSetupStep(2)} className="w-full">
                Continue to Verification
              </Button>
            )}
            {setupStep === 2 && (
              <Button
                onClick={handleVerifySetup}
                disabled={verifyCode.length !== 6 || isVerifying}
                className="w-full"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Verifying...
                  </>
                ) : (
                  "Verify & Enable"
                )}
              </Button>
            )}
            {setupStep === 3 && (
              <Button onClick={() => setShowSetupDialog(false)} className="w-full">
                Done
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable 2FA Dialog */}
      <AlertDialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Two-Factor Authentication?</AlertDialogTitle>
            <AlertDialogDescription>
              This will make your account less secure. Enter your current 2FA code or a backup code to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-4">
            <Label className="mb-2 block">Enter 2FA Code or Backup Code</Label>
            <InputOTP
              maxLength={8}
              value={disableCode}
              onChange={(value) => setDisableCode(value)}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
                <InputOTPSlot index={6} />
                <InputOTPSlot index={7} />
              </InputOTPGroup>
            </InputOTP>
            <p className="text-xs text-muted-foreground mt-2">
              Enter 6-digit TOTP code or 8-character backup code
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDisableCode("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisable2FA}
              disabled={disableCode.length < 6 || isDisabling}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDisabling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Disabling...
                </>
              ) : (
                "Disable 2FA"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
