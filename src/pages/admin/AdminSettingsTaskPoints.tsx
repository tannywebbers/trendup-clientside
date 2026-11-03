import { useState, useEffect } from "react";
import { Settings2, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PlatformSettings {
  pointsPerLike: number;
  pointsPerComment: number;
  pointsPerSave: number;
  pointsPerFollow: number;
  pointsPerComboMini: number;
  pointsPerComboLarge: number;
}

const FIELDS: { key: keyof PlatformSettings; label: string; hint: string }[] = [
  { key: "pointsPerLike", label: "Like Task", hint: "Points for a recorded like" },
  { key: "pointsPerComment", label: "Comment Task", hint: "Points for a recorded comment" },
  { key: "pointsPerSave", label: "Save Task", hint: "Points for a recorded save" },
  { key: "pointsPerFollow", label: "Follow Task", hint: "Points for a recorded follow" },
  { key: "pointsPerComboMini", label: "Combo Mini", hint: "Like + Comment + Save" },
  { key: "pointsPerComboLarge", label: "Combo Large", hint: "Like + Comment + Save + Follow" },
];

export default function AdminSettingsTaskPoints() {
  const [settings, setSettings] = useState<PlatformSettings>({
    pointsPerLike: 10,
    pointsPerComment: 15,
    pointsPerSave: 10,
    pointsPerFollow: 20,
    pointsPerComboMini: 30,
    pointsPerComboLarge: 50,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from("platform_settings")
        .select("*")
        .eq("key", "task_points")
        .maybeSingle();
      if (data && typeof data.value === "object" && data.value !== null) {
        setSettings((prev) => ({ ...prev, ...(data.value as unknown as PlatformSettings) }));
      }
    } catch (error) {
      console.error("Error fetching task points:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: existing } = await supabase
        .from("platform_settings")
        .select("id")
        .eq("key", "task_points")
        .maybeSingle();
      const value = JSON.parse(JSON.stringify(settings));
      if (existing) {
        const { error } = await supabase
          .from("platform_settings")
          .update({ value })
          .eq("key", "task_points");
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("platform_settings")
          .insert([{ key: "task_points", value }]);
        if (error) throw error;
      }
      toast({ title: "Saved", description: "Default task points updated." });
    } catch (error) {
      console.error("Error saving task points:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to save task points." });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Task Points</h1>
          <p className="text-sm text-muted-foreground mt-1">Default point values for each engagement task</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Settings2 className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <CardTitle>Default Points per Task</CardTitle>
              <CardDescription>
                These defaults apply to tasks that don't override point values
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            {FIELDS.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label>{field.label}</Label>
                <Input
                  type="number"
                  min={0}
                  value={settings[field.key]}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, [field.key]: parseInt(e.target.value) || 0 }))
                  }
                />
                <p className="text-xs text-muted-foreground">{field.hint}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}