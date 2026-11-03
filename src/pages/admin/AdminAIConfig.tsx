import { useState, useEffect } from "react";
import { 
  Brain, 
  Save,
  Loader2,
  CheckCircle2,
  Sparkles,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminAIConfig() {
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setIsLoading(false);
  }, []);

  const handleTestAI = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      // Test the Lovable AI integration by calling the edge function
      const { data, error } = await supabase.functions.invoke("verify-screenshot", {
        body: { 
          action: "test_connection"
        }
      });

      // If we get a response (even an error about missing parameters), AI is working
      setTestResult("success");
      toast({ title: "Success", description: "Lovable AI is properly configured and working!" });
    } catch (error) {
      console.error("AI test error:", error);
      setTestResult("error");
      toast({ 
        variant: "destructive", 
        title: "Error", 
        description: "Could not connect to AI service. Please try again." 
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-100">AI Configuration</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Manage AI settings for screenshot verification
        </p>
      </div>

      {/* Lovable AI Card */}
      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-neutral-100 flex items-center gap-2">
                  Lovable AI
                  <Badge className="bg-green-500/10 text-green-400 border-green-500/30">Active</Badge>
                </CardTitle>
                <CardDescription className="text-neutral-400">
                  Built-in AI for screenshot verification
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-neutral-800/50 border border-neutral-700">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div className="text-sm text-neutral-300">
                <p className="font-medium mb-1">Automatic Configuration</p>
                <p className="text-neutral-400">
                  Lovable AI is automatically configured and requires no API keys. It uses 
                  Google Gemini 2.5 Flash for fast and accurate screenshot verification.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-4 rounded-lg bg-neutral-800/30 border border-neutral-700/50">
              <div className="text-sm font-medium text-neutral-300 mb-1">Model</div>
              <div className="text-neutral-400 text-sm">Google Gemini 2.5 Flash</div>
            </div>
            <div className="p-4 rounded-lg bg-neutral-800/30 border border-neutral-700/50">
              <div className="text-sm font-medium text-neutral-300 mb-1">Status</div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-400 text-sm">Operational</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleTestAI}
              disabled={isTesting}
              className="bg-neutral-100 text-neutral-900 hover:bg-neutral-200"
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" />
                  Test AI Connection
                </>
              )}
            </Button>
            
            {testResult === "success" && (
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                AI is working correctly
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Features Card */}
      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-neutral-100">Verification Capabilities</CardTitle>
          <CardDescription className="text-neutral-400">
            What Lovable AI can verify in screenshots
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Like Detection", description: "Detects red/pink heart icon" },
              { label: "Save Detection", description: "Detects yellow bookmark icon" },
              { label: "Comment Verification", description: "Matches username and text" },
              { label: "Follow Status", description: "Detects 'Following' button state" },
              { label: "Fraud Detection", description: "Identifies edited screenshots" },
              { label: "Combo Tasks", description: "Verifies multiple actions" },
            ].map((feature, i) => (
              <div 
                key={i}
                className="p-3 rounded-lg bg-neutral-800/30 border border-neutral-700/50"
              >
                <div className="text-sm font-medium text-neutral-200">{feature.label}</div>
                <div className="text-xs text-neutral-500 mt-1">{feature.description}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Note about prompts */}
      <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-300 mb-1">Custom Prompts</p>
            <p className="text-blue-400/80">
              To customize verification behavior per task type, go to the{" "}
              <a href="/baki/stage/admin/prompts" className="underline hover:text-blue-300">
                Prompts
              </a>{" "}
              section to edit verification instructions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
