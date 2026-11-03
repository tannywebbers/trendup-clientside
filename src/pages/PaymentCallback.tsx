import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2, XCircle, Coins } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying');
  const [message, setMessage] = useState('Verifying your payment...');

  useEffect(() => {
    const verifyPayment = async () => {
      // Get reference from URL query params
      const reference = searchParams.get('reference');
      
      if (!reference) {
        setStatus('failed');
        setMessage('Payment reference not found');
        return;
      }

      try {
        // Call the paystack-verify edge function
        const { data, error } = await supabase.functions.invoke('paystack-verify', {
          body: { reference }
        });

        if (error) {
          console.error('Verification error:', error);
          setStatus('failed');
          setMessage('Payment verification failed. Please contact support if you were charged.');
          
          toast({
            variant: "destructive",
            title: "Verification Failed",
            description: "Unable to verify payment. Contact support if needed.",
          });
          return;
        }

        if (data?.success) {
          setStatus('success');
          setMessage(data.message || 'Payment successful! Your points have been credited.');
          
          toast({
            title: "Payment Successful!",
            description: `${data.points || 'Your'} Streak Points have been added to your account.`,
          });

          // Redirect to dashboard after 3 seconds
          setTimeout(() => {
            navigate('/dashboard');
          }, 3000);
        } else {
          setStatus('failed');
          setMessage(data?.message || 'Payment could not be verified');
          
          toast({
            variant: "destructive",
            title: "Payment Failed",
            description: data?.message || "Transaction was not successful",
          });
        }
      } catch (err) {
        console.error('Payment verification error:', err);
        setStatus('failed');
        setMessage('An error occurred during verification');
        
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to verify payment. Please contact support.",
        });
      }
    };

    verifyPayment();
  }, [searchParams, navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <Card>
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col items-center text-center space-y-4">
              {status === 'verifying' && (
                <>
                  <Loader2 className="w-16 h-16 text-primary animate-spin" />
                  <h2 className="text-2xl font-bold">Verifying Payment</h2>
                  <p className="text-muted-foreground">{message}</p>
                </>
              )}

              {status === 'success' && (
                <>
                  <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-green-600 dark:text-green-400">Payment Successful!</h2>
                  <p className="text-muted-foreground">{message}</p>
                  <div className="flex items-center gap-2 text-primary">
                    <Coins className="w-5 h-5" />
                    <span className="font-semibold">Redirecting to dashboard...</span>
                  </div>
                </>
              )}

              {status === 'failed' && (
                <>
                  <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                    <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">Payment Failed</h2>
                  <p className="text-muted-foreground">{message}</p>
                  <div className="flex flex-col gap-2 w-full mt-4">
                    <Button onClick={() => navigate('/dashboard')} className="w-full">
                      Return to Dashboard
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => window.location.href = 'mailto:support@trendup.com'}
                      className="w-full"
                    >
                      Contact Support
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
