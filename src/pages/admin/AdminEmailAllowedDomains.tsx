import { useState, useEffect } from "react";
import { Plus, Trash2, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsHeader } from "./components/SettingsList";

interface AllowedDomain {
  id: string;
  domain: string;
  is_enabled: boolean;
}

export default function AdminEmailAllowedDomains() {
  const [domains, setDomains] = useState<AllowedDomain[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchDomains();
  }, []);

  const fetchDomains = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from("allowed_email_domains")
        .select("*")
        .order("domain");
      setDomains(data || []);
    } catch (error) {
      console.error("Error fetching domains:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddDomain = async () => {
    if (!newDomain.trim()) return;
    const domain = newDomain.toLowerCase().trim();
    if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(domain)) {
      toast({ variant: "destructive", title: "Invalid domain", description: "Please enter a valid domain (e.g., gmail.com)." });
      return;
    }
    setIsAdding(true);
    try {
      const { data, error } = await supabase
        .from("allowed_email_domains")
        .insert({ domain, is_enabled: true })
        .select()
        .single();
      if (error) {
        if (error.code === "23505") {
          toast({ variant: "destructive", title: "Error", description: "Domain already exists." });
        } else {
          throw error;
        }
        return;
      }
      setDomains((prev) => [...prev, data]);
      toast({ title: "Added", description: `${domain} added to allowed domains.` });
      setNewDomain("");
    } catch (error) {
      console.error("Error adding domain:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to add domain." });
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggle = async (domain: AllowedDomain) => {
    try {
      const { error } = await supabase
        .from("allowed_email_domains")
        .update({ is_enabled: !domain.is_enabled })
        .eq("id", domain.id);
      if (error) throw error;
      setDomains((prev) => prev.map((d) => (d.id === domain.id ? { ...d, is_enabled: !d.is_enabled } : d)));
    } catch (error) {
      console.error("Error toggling domain:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to update domain." });
    }
  };

  const handleDelete = async (domain: AllowedDomain) => {
    try {
      const { error } = await supabase
        .from("allowed_email_domains")
        .delete()
        .eq("id", domain.id);
      if (error) throw error;
      setDomains((prev) => prev.filter((d) => d.id !== domain.id));
      toast({ title: "Deleted", description: `${domain.domain} removed.` });
    } catch (error) {
      console.error("Error deleting domain:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to delete domain." });
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
      <SettingsHeader
        title="Allowed Email Domains"
        description="Restrict registration to specific email domains"
        backHref="/baki/stage/admin/settings/email"
      />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <CardTitle>Allowed Domains</CardTitle>
              <CardDescription>Leave empty to allow all domains</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {domains.length === 0 ? (
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <p className="text-muted-foreground text-sm">No domain restrictions. All email domains are allowed.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {domains.map((domain) => (
                <div key={domain.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-3">
                    <Switch checked={domain.is_enabled} onCheckedChange={() => handleToggle(domain)} />
                    <span className={domain.is_enabled ? "" : "text-muted-foreground line-through"}>{domain.domain}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(domain)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="gmail.com"
              onKeyDown={(e) => e.key === "Enter" && handleAddDomain()}
            />
            <Button onClick={handleAddDomain} disabled={!newDomain.trim() || isAdding}>
              <Plus className="w-4 h-4 mr-2" />
              Add Domain
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}