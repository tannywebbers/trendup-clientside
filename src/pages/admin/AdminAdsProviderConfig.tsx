import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  Save,
  Loader2,
  Eye,
  EyeOff,
  AlertTriangle,
  Square,
  Layers,
  LayoutGrid,
  MessageSquare,
  ExternalLink,
  Megaphone,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SettingsHeader } from "./components/SettingsList";

interface AdSetting {
  id: string;
  ad_type: string;
  is_enabled: boolean;
  ad_code: string;
  placement: string;
  provider: string;
}

const PLACEMENT_OPTIONS = [
  { value: "header", label: "Header" },
  { value: "footer", label: "Footer" },
  { value: "sidebar", label: "Sidebar" },
  { value: "in-content", label: "In-content (feed)" },
  { value: "native-feed", label: "Native feed" },
  { value: "overlay", label: "Overlay (popup)" },
  { value: "fullscreen", label: "Fullscreen (interstitial)" },
  { value: "social-bar", label: "Floating social bar" },
];

const TYPE_INFO: Record<string, { label: string; description: string; icon: any; recommended: string }> = {
  banner_top: { label: "Banner Top", description: "Horizontal banner at the top of pages", icon: Square, recommended: "728×90 or 970×90" },
  banner_bottom: { label: "Banner Bottom", description: "Horizontal banner at the bottom of pages", icon: Square, recommended: "728×90 or 320×50" },
  banner_sidebar: { label: "Banner Sidebar", description: "Vertical banner in sidebar areas", icon: Layers, recommended: "300×250 or 160×600" },
  native_feed: { label: "Native Feed", description: "Ads blended into content feeds", icon: LayoutGrid, recommended: "300×250 or Responsive" },
  popup: { label: "Popup", description: "Modal popup ads", icon: MessageSquare, recommended: "800×600" },
  popunder: { label: "Popunder", description: "Opens in background tab", icon: ExternalLink, recommended: "Any" },
  social_bar: { label: "Social Bar", description: "Floating notification-style bar", icon: Megaphone, recommended: "Determined by provider" },
  interstitial: { label: "Interstitial", description: "Full-screen ads between page loads", icon: Square, recommended: "Fullscreen" },
};

const DEFAULT_PLACEMENT: Record<string, string> = {
  banner_top: "header",
  banner_bottom: "footer",
  banner_sidebar: "sidebar",
  native_feed: "in-content",
  popup: "overlay",
  popunder: "overlay",
  social_bar: "social-bar",
  interstitial: "fullscreen",
};

const PROVIDER_INFO: Record<string, { name: string; instructions: string[]; codeHint: string }> = {
  adsterra: {
    name: "Adsterra",
    instructions: [
      "Sign up at adsterra.com and create a placement matching the ad type below.",
      "Copy the complete ad script code from your Adsterra dashboard.",
      "Paste the script into the code field for that placement.",
      "Enable the switch to start showing the ad. Use popup/popunder sparingly.",
    ],
    codeHint: "Paste the complete <script> tag from Adsterra",
  },
  google_ads: {
    name: "Google Ads (AdSense)",
    instructions: [
      "Go to Google AdSense → Ads → By ad unit and create a new ad unit (choose responsive/auto).",
      "Copy the full snippet — the <ins class='adsbygoogle' data-ad-client='ca-pub-...' data-ad-slot='...'></ins> block together with the <script>(adsbygoogle = window.adsbygoogle || []).push({});</script> line.",
      "Paste the full snippet into the code field below.",
      "The adsbygoogle loader script is injected automatically once per page, so you only paste the ad unit snippet.",
    ],
    codeHint: "Paste the <ins> block + the (adsbygoogle).push snippet from AdSense",
  },
};

export default function AdminAdsProviderConfig() {
  const { provider = "adsterra" } = useParams<{ provider: string }>();
  const info = PROVIDER_INFO[provider] || PROVIDER_INFO.adsterra;
  const [adSettings, setAdSettings] = useState<AdSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchAdSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const fetchAdSettings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("ad_settings")
        .select("*")
        .order("ad_type");
      if (error) throw error;
      setAdSettings(
        (data || []).map((ad: any) => ({
          ...ad,
          provider: ad.provider || "adsterra",
          placement: ad.placement || DEFAULT_PLACEMENT[ad.ad_type] || "in-content",
        }))
      );
    } catch (error) {
      console.error("Error fetching ad settings:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load ad settings." });
    } finally {
      setIsLoading(false);
    }
  };

  const updateAd = (adType: string, field: keyof AdSetting, value: any) => {
    setAdSettings((prev) => prev.map((ad) => (ad.ad_type === adType ? { ...ad, [field]: value } : ad)));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      for (const ad of adSettings) {
        const { error } = await supabase
          .from("ad_settings")
          .update({
            provider,
            is_enabled: ad.is_enabled,
            ad_code: ad.ad_code,
            placement: ad.placement,
          })
          .eq("ad_type", ad.ad_type);
        if (error) throw error;
      }
      toast({ title: "Saved", description: `${info.name} settings updated.` });
    } catch (error) {
      console.error("Error saving ad settings:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to save ad settings." });
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
    <div className="space-y-6 max-w-4xl">
      <SettingsHeader
        title={info.name}
        description="Configure your placements, codes and where they show"
        backHref="/baki/stage/admin/settings/ads"
      />

      {/* Instructions */}
      <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
        <div className="flex items-center gap-2 text-warning text-sm font-medium mb-2">
          <AlertTriangle className="w-4 h-4" />
          Setup Instructions
        </div>
        <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
          {info.instructions.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </div>

      {/* Placement grid */}
      <div className="grid gap-4">
        {adSettings.map((ad) => {
          const t = TYPE_INFO[ad.ad_type] || { label: ad.ad_type, description: "Ad placement", icon: Square, recommended: "Variable" };
          const Icon = t.icon;
          const isOpen = expanded === ad.ad_type;
          return (
            <Card key={ad.ad_type}>
              <CardHeader className="cursor-pointer" onClick={() => setExpanded(isOpen ? null : ad.ad_type)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {t.label}
                        {ad.is_enabled ? (
                          <Badge variant="outline" className="text-green-600 border-green-600/30">
                            <Eye className="w-3 h-3 mr-1" /> Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            <EyeOff className="w-3 h-3 mr-1" /> Disabled
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{t.description}</CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={ad.is_enabled}
                    onCheckedChange={(checked) => updateAd(ad.ad_type, "is_enabled", checked)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                {isOpen && (
                  <div className="pt-3 border-t mt-3 space-y-4">
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <p className="text-xs font-medium mb-1">
                        Recommended size: <Badge variant="outline" className="text-xs">{t.recommended}</Badge>
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Placement *</Label>
                      <Select
                        value={ad.placement}
                        onValueChange={(v) => updateAd(ad.ad_type, "placement", v)}
                      >
                        <SelectTrigger className="w-full sm:w-64">
                          <SelectValue placeholder="Choose placement" />
                        </SelectTrigger>
                        <SelectContent>
                          {PLACEMENT_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Where this ad renders across the app. Choose the spot that balances revenue and user experience.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <Link2 className="w-3.5 h-3.5" /> Ad Code
                      </Label>
                      <Textarea
                        value={ad.ad_code}
                        onChange={(e) => updateAd(ad.ad_type, "ad_code", e.target.value)}
                        className="font-mono text-sm min-h-[120px]"
                        placeholder={info.codeHint}
                      />
                    </div>
                  </div>
                )}
              </CardHeader>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-end sticky bottom-4">
        <Button onClick={handleSave} disabled={isSaving} className="shadow-lg">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save {info.name} Settings
        </Button>
      </div>
    </div>
  );
}