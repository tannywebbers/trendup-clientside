import { useState, useEffect, useRef } from "react";
import { 
  Settings, 
  Save, 
  Loader2, 
  Globe, 
  Palette, 
  Image,
  Type,
  Smartphone,
  Hash,
  Share2,
  MessageCircle,
  MessageSquare,
  Mail,
  Upload,
  Building2
} from "lucide-react";
import { 
  FaFacebook, 
  FaTwitter, 
  FaInstagram, 
  FaTiktok, 
  FaYoutube 
} from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SocialLinks {
  facebook: string;
  twitter: string;
  instagram: string;
  tiktok: string;
  youtube: string;
}

interface AppSettings {
  id?: string;
  app_name: string;
  app_description: string;
  meta_title: string;
  meta_description: string;
  logo_url: string;
  favicon_url: string;
  pwa_icon_url: string;
  primary_color: string;
  accent_color: string;
  platform_name: string;
  platform_username_label: string;
  platform_display_name_label: string;
  points_name: string;
  points_short_name: string;
  social_links: SocialLinks;
  community_link: string;
  community_label: string;
  support_email: string;
  live_chat_welcome?: string;
}

const defaultSettings: AppSettings = {
  app_name: "TrendUp",
  app_description: "Earn points by engaging with TikTok content",
  meta_title: "TrendUp - TikTok Engagement Exchange",
  meta_description: "The leading platform for TikTok engagement exchange. Earn and advertise smarter.",
  logo_url: "",
  favicon_url: "",
  pwa_icon_url: "",
  primary_color: "#ec4899",
  accent_color: "#06b6d4",
  platform_name: "TikTok",
  platform_username_label: "TikTok Username",
  platform_display_name_label: "TikTok Display Name",
  points_name: "Streak Points",
  points_short_name: "Points",
  social_links: {
    facebook: "",
    twitter: "",
    instagram: "",
    tiktok: "",
    youtube: "",
  },
  community_link: "",
  community_label: "",
  support_email: "",
  live_chat_welcome: "Hello {name}! 👋 Welcome to support. How can we help you today?",
};

export default function AdminAppSettings({ initialTab = "branding" }: { initialTab?: string } = {}) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [siteSettings, setSiteSettings] = useState<{ site_name: string; site_logo: string; support_email: string; maintenance_mode: boolean }>({
    site_name: "TrendUp",
    site_logo: "",
    support_email: "",
    maintenance_mode: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPwa, setIsUploadingPwa] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingFavicon, setIsUploadingFavicon] = useState(false);
  const pwaFileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const faviconFileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setSettings({
          ...defaultSettings,
          ...data,
          social_links: (data.social_links as unknown as SocialLinks) || defaultSettings.social_links,
        });
      }

      const { data: siteData } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "site_settings")
        .maybeSingle();
      if (siteData && typeof siteData.value === "object" && siteData.value !== null) {
        setSiteSettings((prev) => ({ ...prev, ...(siteData.value as unknown as typeof siteSettings) }));
      }
    } catch (error) {
      console.error("Error fetching app settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { live_chat_welcome, ...rest } = settings as any;
      const saveData = {
        ...rest,
        social_links: (rest.social_links || settings.social_links) as unknown as Record<string, string>,
        ...(live_chat_welcome !== undefined ? { live_chat_welcome } : {}),
      };
      
      if (settings.id) {
        const { error } = await supabase
          .from("app_settings")
          .update(saveData)
          .eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("app_settings")
          .insert([saveData]);
        if (error) throw error;
      }

      toast({ title: "Saved", description: "App settings updated successfully!" });
      
      // Mirror branding into site_settings (PWA manifest + maintenance screen)
      const { data: existing } = await supabase
        .from("platform_settings")
        .select("id")
        .eq("key", "site_settings")
        .maybeSingle();
      const siteValue = {
        site_name: siteSettings.site_name,
        site_logo: settings.logo_url || siteSettings.site_logo,
        support_email: siteSettings.support_email,
        maintenance_mode: siteSettings.maintenance_mode,
      };
      if (existing) {
        await supabase.from("platform_settings").update({ value: siteValue }).eq("key", "site_settings");
      } else {
        await supabase.from("platform_settings").insert([{ key: "site_settings", value: siteValue }]);
      }
      
      // Update document title immediately
      document.title = settings.meta_title || settings.app_name;
      
      // Update favicon if set
      if (settings.favicon_url) {
        const link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
        if (link) link.href = settings.favicon_url;
      }
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast({ variant: "destructive", title: "Error", description: error?.message || "Failed to save settings." });
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: keyof AppSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const updateSocialLink = (platform: keyof SocialLinks, value: string) => {
    setSettings(prev => ({
      ...prev,
      social_links: { ...prev.social_links, [platform]: value },
    }));
  };

  const handlePwaIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ variant: "destructive", title: "Invalid file", description: "Please upload an image file (PNG recommended, 512x512px)" });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Please upload an image smaller than 2MB" });
      return;
    }

    setIsUploadingPwa(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `pwa-icon-${Date.now()}.${fileExt}`;
      const filePath = `icons/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('app-assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('app-assets')
        .getPublicUrl(filePath);

      setSettings(prev => ({ ...prev, pwa_icon_url: publicUrl }));
      toast({ title: "Uploaded", description: "PWA icon uploaded successfully. Click 'Save All' to apply." });
    } catch (error) {
      console.error("Error uploading PWA icon:", error);
      toast({ variant: "destructive", title: "Upload failed", description: "Failed to upload PWA icon" });
    } finally {
      setIsUploadingPwa(false);
      if (pwaFileInputRef.current) pwaFileInputRef.current.value = '';
    }
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "logo_url" | "favicon_url",
    setUploading: (v: boolean) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", title: "Invalid file", description: "Please upload an image file." });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Please upload an image smaller than 2MB" });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${field === "logo_url" ? "logo" : "favicon"}-${Date.now()}.${fileExt}`;
      const filePath = `images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("app-assets")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("app-assets")
        .getPublicUrl(filePath);

      setSettings((prev) => ({ ...prev, [field]: publicUrl }));
      toast({ title: "Uploaded", description: "Image uploaded. Click 'Save All' to apply." });
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({ variant: "destructive", title: "Upload failed", description: "Failed to upload image" });
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">App Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure your app branding, social links, and platform settings
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save All
        </Button>
      </div>

      <Tabs defaultValue={initialTab} className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="branding">
            <Palette className="w-4 h-4 mr-2" /> Branding
          </TabsTrigger>
          <TabsTrigger value="seo">
            <Globe className="w-4 h-4 mr-2" /> SEO & Meta
          </TabsTrigger>
          <TabsTrigger value="platform">
            <Smartphone className="w-4 h-4 mr-2" /> Platform
          </TabsTrigger>
          <TabsTrigger value="social">
            <Share2 className="w-4 h-4 mr-2" /> Social & Community
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="space-y-6">
          {/* General Site Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" /> General Site Settings
              </CardTitle>
              <CardDescription>Site-level details shown across the app and PWA</CardDescription>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Site Name</Label>
                <Input
                  value={siteSettings.site_name}
                  onChange={(e) => setSiteSettings((prev) => ({ ...prev, site_name: e.target.value }))}
                  placeholder="TrendUp"
                />
              </div>
              <div className="space-y-2">
                <Label>Support Email</Label>
                <Input
                  type="email"
                  value={siteSettings.support_email}
                  onChange={(e) => setSiteSettings((prev) => ({ ...prev, support_email: e.target.value }))}
                  placeholder="support@trendup.com"
                />
              </div>
            </CardContent>
          </Card>

          {/* App Identity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Type className="w-5 h-5" /> App Identity
              </CardTitle>
              <CardDescription>Basic app name and description</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>App Name</Label>
                  <Input
                    value={settings.app_name}
                    onChange={(e) => updateField("app_name", e.target.value)}
                    placeholder="TrendUp"
                  />
                  <p className="text-xs text-muted-foreground">Shown in navbar and footer</p>
                </div>
                <div className="space-y-2">
                  <Label>Points Name</Label>
                  <Input
                    value={settings.points_name}
                    onChange={(e) => updateField("points_name", e.target.value)}
                    placeholder="TrendUp"
                  />
                  <p className="text-xs text-muted-foreground">Name for your points currency</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>App Description</Label>
                <Textarea
                  value={settings.app_description}
                  onChange={(e) => updateField("app_description", e.target.value)}
                  placeholder="Earn points by engaging with content"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Visual Identity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="w-5 h-5" /> Visual Identity
              </CardTitle>
              <CardDescription>Logo, favicon, and colors</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Logo URL</Label>
                  <Input
                    value={settings.logo_url}
                    onChange={(e) => updateField("logo_url", e.target.value)}
                    placeholder="https://example.com/logo.png"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={logoFileInputRef}
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={(e) => handleImageUpload(e, "logo_url", setIsUploadingLogo)}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => logoFileInputRef.current?.click()}
                      disabled={isUploadingLogo}
                    >
                      {isUploadingLogo ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                      Upload Logo
                    </Button>
                    {settings.logo_url && <span className="text-xs text-green-600">✓ uploaded to Supabase</span>}
                  </div>
                  {settings.logo_url && (
                    <div className="mt-2 p-3 bg-muted rounded-lg">
                      <img 
                        src={settings.logo_url} 
                        alt="Logo preview" 
                        className="h-12 object-contain"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Favicon URL</Label>
                  <Input
                    value={settings.favicon_url}
                    onChange={(e) => updateField("favicon_url", e.target.value)}
                    placeholder="https://example.com/favicon.ico"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={faviconFileInputRef}
                      accept="image/png,image/x-icon,image/svg+xml,image/jpeg,image/webp"
                      onChange={(e) => handleImageUpload(e, "favicon_url", setIsUploadingFavicon)}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => faviconFileInputRef.current?.click()}
                      disabled={isUploadingFavicon}
                    >
                      {isUploadingFavicon ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                      Upload Favicon
                    </Button>
                    {settings.favicon_url && <span className="text-xs text-green-600">✓ uploaded to Supabase</span>}
                  </div>
                  {settings.favicon_url && (
                    <div className="mt-2 p-3 bg-muted rounded-lg">
                      <img 
                        src={settings.favicon_url} 
                        alt="Favicon preview" 
                        className="h-8 object-contain"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    </div>
                  )}
                </div>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={settings.primary_color}
                      onChange={(e) => updateField("primary_color", e.target.value)}
                      className="w-14 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={settings.primary_color}
                      onChange={(e) => updateField("primary_color", e.target.value)}
                      placeholder="#ec4899"
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Accent Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={settings.accent_color}
                      onChange={(e) => updateField("accent_color", e.target.value)}
                      className="w-14 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={settings.accent_color}
                      onChange={(e) => updateField("accent_color", e.target.value)}
                      placeholder="#06b6d4"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              {/* PWA Icon Upload Section */}
              <div className="border-t pt-4 mt-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4" />
                    PWA App Icon (for mobile installations)
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Upload a square PNG image (512x512px recommended) that will be used when users install the app on their mobile devices.
                  </p>
                  <div className="flex items-center gap-4">
                    <input
                      type="file"
                      ref={pwaFileInputRef}
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handlePwaIconUpload}
                      className="hidden"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => pwaFileInputRef.current?.click()}
                      disabled={isUploadingPwa}
                    >
                      {isUploadingPwa ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      Upload PWA Icon
                    </Button>
                    {settings.pwa_icon_url && (
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
                          <img 
                            src={settings.pwa_icon_url} 
                            alt="PWA Icon preview" 
                            className="w-full h-full object-contain"
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                          />
                        </div>
                        <span className="text-sm text-green-600">✓ Icon uploaded</span>
                      </div>
                    )}
                  </div>
                  {settings.pwa_icon_url && (
                    <Input
                      value={settings.pwa_icon_url}
                      onChange={(e) => updateField("pwa_icon_url", e.target.value)}
                      placeholder="Or paste URL directly"
                      className="mt-2"
                    />
                  )}
                  {!settings.pwa_icon_url && (
                    <Input
                      value={settings.pwa_icon_url}
                      onChange={(e) => updateField("pwa_icon_url", e.target.value)}
                      placeholder="Or paste icon URL directly"
                      className="mt-2"
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seo" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" /> SEO Settings
              </CardTitle>
              <CardDescription>Meta tags for search engines</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Meta Title</Label>
                <Input
                  value={settings.meta_title}
                  onChange={(e) => updateField("meta_title", e.target.value)}
                  placeholder="TrendUp - TikTok Engagement Exchange"
                />
                <p className="text-xs text-muted-foreground">
                  {settings.meta_title.length}/60 characters (recommended max)
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Meta Description</Label>
                <Textarea
                  value={settings.meta_description}
                  onChange={(e) => updateField("meta_description", e.target.value)}
                  placeholder="The leading platform for TikTok engagement exchange."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  {settings.meta_description.length}/160 characters (recommended max)
                </p>
              </div>
              
              {/* Preview */}
              <div className="p-4 rounded-lg bg-muted/50 border">
                <p className="text-sm font-medium mb-2">Google Search Preview:</p>
                <div className="text-blue-600 text-lg font-medium truncate">
                  {settings.meta_title || "Page Title"}
                </div>
                <div className="text-green-700 text-sm">
                  yourdomain.com
                </div>
                <div className="text-sm text-muted-foreground line-clamp-2">
                  {settings.meta_description || "Page description will appear here..."}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="platform" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5" /> Social Platform
              </CardTitle>
              <CardDescription>
                Configure which social platform your app targets. Change these to rebrand for Instagram, Facebook, X, etc.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-sm">
                  <strong>Multi-Platform Ready:</strong> Change the platform name and labels below to transform this app for any social network!
                </p>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Platform Name</Label>
                  <Input
                    value={settings.platform_name}
                    onChange={(e) => updateField("platform_name", e.target.value)}
                    placeholder="TikTok"
                  />
                  <p className="text-xs text-muted-foreground">e.g., TikTok, Instagram, X, Facebook</p>
                </div>
                <div className="space-y-2">
                  <Label>Points Short Name</Label>
                  <Input
                    value={settings.points_short_name}
                    onChange={(e) => updateField("points_short_name", e.target.value)}
                    placeholder="pts"
                  />
                  <p className="text-xs text-muted-foreground">e.g., pts, coins, credits</p>
                </div>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Username Field Label</Label>
                  <Input
                    value={settings.platform_username_label}
                    onChange={(e) => updateField("platform_username_label", e.target.value)}
                    placeholder="TikTok Username"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Display Name Field Label</Label>
                  <Input
                    value={settings.platform_display_name_label}
                    onChange={(e) => updateField("platform_display_name_label", e.target.value)}
                    placeholder="TikTok Display Name"
                  />
                </div>
              </div>
              
              {/* Preview */}
              <div className="p-4 rounded-lg border bg-muted/30 space-y-2">
                <p className="text-sm font-medium">Preview:</p>
                <p className="text-sm text-muted-foreground">
                  "Earn <strong>{settings.points_name}</strong> by engaging on <strong>{settings.platform_name}</strong>!"
                </p>
                <p className="text-sm text-muted-foreground">
                  Form label: "<strong>{settings.platform_username_label}</strong>"
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

          <TabsContent value="social" className="space-y-6">
            {/* Live Chat */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" /> Live Chat
                </CardTitle>
                <CardDescription>
                  Customize the greeting message shown to customers when they open live chat
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="live_chat_welcome">Live Chat Welcome Message</Label>
                  <textarea
                    id="live_chat_welcome"
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={settings.live_chat_welcome || ""}
                    onChange={(e) => updateField("live_chat_welcome", e.target.value)}
                    placeholder="Hello {name}! 👋 Welcome to support. How can we help you today?"
                  />
                  <p className="text-xs text-muted-foreground">Use {'{name}'} to insert the customer's first name</p>
                </div>
              </CardContent>
            </Card>
            {/* Social Media Links */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="w-5 h-5" /> Social Media Links
                </CardTitle>
                <CardDescription>
                  Add your social media profile links. These will appear in the footer.
                </CardDescription>
              </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FaFacebook className="w-4 h-4 text-blue-600" /> Facebook
                  </Label>
                  <Input
                    value={settings.social_links.facebook}
                    onChange={(e) => updateSocialLink("facebook", e.target.value)}
                    placeholder="https://facebook.com/yourpage"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FaTwitter className="w-4 h-4 text-sky-500" /> Twitter / X
                  </Label>
                  <Input
                    value={settings.social_links.twitter}
                    onChange={(e) => updateSocialLink("twitter", e.target.value)}
                    placeholder="https://twitter.com/yourhandle"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FaInstagram className="w-4 h-4 text-pink-500" /> Instagram
                  </Label>
                  <Input
                    value={settings.social_links.instagram}
                    onChange={(e) => updateSocialLink("instagram", e.target.value)}
                    placeholder="https://instagram.com/yourprofile"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FaTiktok className="w-4 h-4" /> TikTok
                  </Label>
                  <Input
                    value={settings.social_links.tiktok}
                    onChange={(e) => updateSocialLink("tiktok", e.target.value)}
                    placeholder="https://tiktok.com/@yourprofile"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FaYoutube className="w-4 h-4 text-red-600" /> YouTube
                  </Label>
                  <Input
                    value={settings.social_links.youtube}
                    onChange={(e) => updateSocialLink("youtube", e.target.value)}
                    placeholder="https://youtube.com/@yourchannel"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Community Link */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" /> Community Channel
              </CardTitle>
              <CardDescription>
                Add a link to your WhatsApp channel, Telegram group, or Discord server.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Community Link</Label>
                  <Input
                    value={settings.community_link}
                    onChange={(e) => updateField("community_link", e.target.value)}
                    placeholder="https://chat.whatsapp.com/... or https://t.me/..."
                  />
                  <p className="text-xs text-muted-foreground">
                    WhatsApp, Telegram, or Discord link
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Link Label</Label>
                  <Input
                    value={settings.community_label}
                    onChange={(e) => updateField("community_label", e.target.value)}
                    placeholder="Join our Community"
                  />
                  <p className="text-xs text-muted-foreground">
                    Text shown in the footer
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Support Email */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" /> Support Email
              </CardTitle>
              <CardDescription>
                Email address for the Contact Us page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Support Email</Label>
                <Input
                  type="email"
                  value={settings.support_email}
                  onChange={(e) => updateField("support_email", e.target.value)}
                  placeholder="support@yourapp.com"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
