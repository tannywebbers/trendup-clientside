import { useState, useEffect, useRef } from "react";
import { 
  Eye, 
  Edit3, 
  Save, 
  Loader2, 
  Plus, 
  Trash2, 
  GripVertical,
  Type,
  Image,
  Link2,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Settings2,
  Palette,
  LayoutGrid,
  Code,
  X,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LandingSection {
  id: string;
  section_key: string;
  title: string | null;
  subtitle: string | null;
  content: string | null;
  image_url: string | null;
  button_text: string | null;
  button_url: string | null;
  is_visible: boolean;
  sort_order: number;
  metadata: any;
}

interface StepItem {
  title: string;
  description: string;
  icon?: string;
}

interface StatItem {
  value: string;
  label: string;
  icon?: string;
}

interface FeatureItem {
  title: string;
  description: string;
  icon?: string;
}

interface LegalSectionItem {
  heading: string;
  body: string;
}

interface FAQItem {
  question: string;
  answer: string;
}

const ICON_OPTIONS = [
  "Play", "Heart", "MessageCircle", "Bookmark", "Users", "TrendingUp", 
  "Zap", "Shield", "Clock", "CheckCircle", "Star", "Gift", "Coins"
];

export default function AdminVisualEditor() {
  const [sections, setSections] = useState<LandingSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingSection, setEditingSection] = useState<LandingSection | null>(null);
  const [editMode, setEditMode] = useState<'visual' | 'html'>('visual');
  const [htmlContent, setHtmlContent] = useState("");
  
  // For array-based content (steps, stats, features, legal sections, faqs)
  const [steps, setSteps] = useState<StepItem[]>([]);
  const [stats, setStats] = useState<StatItem[]>([]);
  const [features, setFeatures] = useState<FeatureItem[]>([]);
  const [legalSections, setLegalSections] = useState<LegalSectionItem[]>([]);
  const [faqItems, setFaqItems] = useState<FAQItem[]>([]);
  
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    fetchSections();
  }, []);

  const fetchSections = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("landing_content")
        .select("*")
        .order("sort_order");

      if (error) throw error;
      
      // If no sections exist, create defaults
      if (!data || data.length === 0) {
        await createDefaultSections();
        return;
      }
      
      setSections(data);
    } catch (error) {
      console.error("Error fetching sections:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load landing content." });
    } finally {
      setIsLoading(false);
    }
  };

  const createDefaultSections = async () => {
    const defaultSections = [
      {
        section_key: "hero",
        title: "Earn & Grow on TikTok",
        subtitle: "AI-Powered TikTok Engagement Exchange",
        content: "Exchange engagement for Streak Points. Complete tasks to earn, or boost your content with authentic engagement from real users.",
        button_text: "Start Earning Now",
        button_url: "/register",
        is_visible: true,
        sort_order: 0,
      },
      {
        section_key: "stats",
        title: "Trusted by Thousands",
        subtitle: "Join our growing community",
        content: JSON.stringify([
          { value: "50K+", label: "Active Users" },
          { value: "2M+", label: "Tasks Completed" },
          { value: "99%", label: "Satisfaction Rate" },
          { value: "24/7", label: "Support" }
        ]),
        is_visible: true,
        sort_order: 1,
      },
      {
        section_key: "how_it_works",
        title: "How It Works",
        subtitle: "Start earning Streak Points in minutes with our simple 4-step process",
        content: JSON.stringify([
          { title: "Browse Tasks", description: "Find TikTok posts that need engagement" },
          { title: "Complete Actions", description: "Like, comment, save, or watch videos" },
          { title: "Upload Proof", description: "Submit screenshots of your completed actions" },
          { title: "Earn Points", description: "AI verifies your work and credits points instantly" }
        ]),
        is_visible: true,
        sort_order: 2,
      },
      {
        section_key: "features",
        title: "AI-Powered Verification",
        subtitle: "Why Choose Us",
        content: JSON.stringify([
          { title: "Instant Verification", description: "AI verifies your work in seconds" },
          { title: "Secure Payments", description: "Your earnings are always protected" },
          { title: "24/7 Support", description: "We're here to help anytime" },
          { title: "Fair Pricing", description: "Competitive rates for all tasks" }
        ]),
        is_visible: true,
        sort_order: 3,
      },
      {
        section_key: "cta",
        title: "Ready to Start Earning?",
        subtitle: "Join thousands of users already earning on our platform",
        button_text: "Create Free Account",
        button_url: "/register",
        is_visible: true,
        sort_order: 4,
      },
    ];

    const { error } = await supabase.from("landing_content").insert(defaultSections);
    if (!error) {
      fetchSections();
    }
  };

  const openEditor = (section: LandingSection) => {
    setEditingSection(section);
    setEditMode('visual');
    setHtmlContent(section.content || "");
    
    // Parse array content based on section type
    if (section.section_key === "how_it_works") {
      try {
        const parsed = JSON.parse(section.content || "[]");
        setSteps(Array.isArray(parsed) ? parsed : []);
      } catch {
        setSteps([]);
      }
    } else if (section.section_key === "stats") {
      try {
        const parsed = JSON.parse(section.content || "[]");
        setStats(Array.isArray(parsed) ? parsed : []);
      } catch {
        setStats([]);
      }
    } else if (section.section_key === "features") {
      try {
        const parsed = JSON.parse(section.content || "[]");
        setFeatures(Array.isArray(parsed) ? parsed : []);
      } catch {
        setFeatures([]);
      }
    } else if (["privacy_policy", "terms_of_service", "cookies_policy"].includes(section.section_key)) {
      try {
        const parsed = JSON.parse(section.content || "[]");
        setLegalSections(Array.isArray(parsed) ? parsed : []);
      } catch {
        setLegalSections([]);
      }
    } else if (section.section_key === "faqs") {
      try {
        const parsed = JSON.parse(section.content || "[]");
        setFaqItems(Array.isArray(parsed) ? parsed : []);
      } catch {
        setFaqItems([]);
      }
    }
  };

  const handleSave = async () => {
    if (!editingSection) return;
    
    setIsSaving(true);
    try {
      // Build content based on section type
      let finalContent = editingSection.content;
      
      if (editMode === 'html') {
        finalContent = htmlContent;
      } else {
        if (editingSection.section_key === "how_it_works") {
          finalContent = JSON.stringify(steps);
        } else if (editingSection.section_key === "stats") {
          finalContent = JSON.stringify(stats);
        } else if (editingSection.section_key === "features") {
          finalContent = JSON.stringify(features);
        } else if (["privacy_policy", "terms_of_service", "cookies_policy"].includes(editingSection.section_key)) {
          finalContent = JSON.stringify(legalSections);
        } else if (editingSection.section_key === "faqs") {
          finalContent = JSON.stringify(faqItems);
        }
      }

      const { error } = await supabase
        .from("landing_content")
        .update({
          title: editingSection.title,
          subtitle: editingSection.subtitle,
          content: finalContent,
          image_url: editingSection.image_url,
          button_text: editingSection.button_text,
          button_url: editingSection.button_url,
          is_visible: editingSection.is_visible,
          metadata: editingSection.metadata,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingSection.id);

      if (error) throw error;

      setSections(prev => prev.map(s => 
        s.id === editingSection.id 
          ? { ...editingSection, content: finalContent } 
          : s
      ));
      
      toast({ title: "Saved!", description: `${editingSection.section_key} section updated.` });
      setEditingSection(null);
      
      // Refresh iframe preview
      if (iframeRef.current) {
        iframeRef.current.src = iframeRef.current.src;
      }
    } catch (error) {
      console.error("Error saving:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to save changes." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleVisibility = async (section: LandingSection) => {
    try {
      const { error } = await supabase
        .from("landing_content")
        .update({ is_visible: !section.is_visible })
        .eq("id", section.id);

      if (error) throw error;

      setSections(prev =>
        prev.map(s => (s.id === section.id ? { ...s, is_visible: !s.is_visible } : s))
      );

      toast({ title: "Updated", description: `Section is now ${!section.is_visible ? "visible" : "hidden"}.` });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update visibility." });
    }
  };

  const moveSection = async (section: LandingSection, direction: 'up' | 'down') => {
    const currentIndex = sections.findIndex(s => s.id === section.id);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    if (newIndex < 0 || newIndex >= sections.length) return;
    
    const otherSection = sections[newIndex];
    
    try {
      await supabase.from("landing_content").update({ sort_order: newIndex }).eq("id", section.id);
      await supabase.from("landing_content").update({ sort_order: currentIndex }).eq("id", otherSection.id);
      
      const newSections = [...sections];
      [newSections[currentIndex], newSections[newIndex]] = [newSections[newIndex], newSections[currentIndex]];
      setSections(newSections.map((s, i) => ({ ...s, sort_order: i })));
      
      toast({ title: "Reordered", description: "Section order updated." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to reorder sections." });
    }
  };

  const updateEditingField = (field: keyof LandingSection, value: any) => {
    if (editingSection) {
      setEditingSection({ ...editingSection, [field]: value });
    }
  };

  // Render step/stat/feature item editor
  const renderStepEditor = () => (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Label className="text-base font-semibold">Steps</Label>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => setSteps([...steps, { title: "New Step", description: "Description here" }])}
        >
          <Plus className="w-4 h-4 mr-1" /> Add Step
        </Button>
      </div>
      {steps.map((step, index) => (
        <Card key={index} className="p-3">
          <div className="flex items-start gap-2">
            <div className="flex flex-col gap-1 mt-2">
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                if (index > 0) {
                  const newSteps = [...steps];
                  [newSteps[index], newSteps[index - 1]] = [newSteps[index - 1], newSteps[index]];
                  setSteps(newSteps);
                }
              }}>
                <ArrowUp className="w-3 h-3" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                if (index < steps.length - 1) {
                  const newSteps = [...steps];
                  [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
                  setSteps(newSteps);
                }
              }}>
                <ArrowDown className="w-3 h-3" />
              </Button>
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Step {index + 1}</Badge>
                <Select value={step.icon || "Play"} onValueChange={(v) => {
                  const newSteps = [...steps];
                  newSteps[index] = { ...step, icon: v };
                  setSteps(newSteps);
                }}>
                  <SelectTrigger className="w-28 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map(icon => (
                      <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                placeholder="Step title"
                value={step.title}
                onChange={(e) => {
                  const newSteps = [...steps];
                  newSteps[index] = { ...step, title: e.target.value };
                  setSteps(newSteps);
                }}
              />
              <Textarea
                placeholder="Step description"
                value={step.description}
                rows={2}
                onChange={(e) => {
                  const newSteps = [...steps];
                  newSteps[index] = { ...step, description: e.target.value };
                  setSteps(newSteps);
                }}
              />
            </div>
            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => {
              setSteps(steps.filter((_, i) => i !== index));
            }}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );

  const renderStatsEditor = () => (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Label className="text-base font-semibold">Statistics</Label>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => setStats([...stats, { value: "100+", label: "New Stat" }])}
        >
          <Plus className="w-4 h-4 mr-1" /> Add Stat
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat, index) => (
          <Card key={index} className="p-3">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Badge variant="outline">Stat {index + 1}</Badge>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => {
                  setStats(stats.filter((_, i) => i !== index));
                }}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <Input
                placeholder="Value (e.g., 50K+)"
                value={stat.value}
                onChange={(e) => {
                  const newStats = [...stats];
                  newStats[index] = { ...stat, value: e.target.value };
                  setStats(newStats);
                }}
              />
              <Input
                placeholder="Label"
                value={stat.label}
                onChange={(e) => {
                  const newStats = [...stats];
                  newStats[index] = { ...stat, label: e.target.value };
                  setStats(newStats);
                }}
              />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderFeaturesEditor = () => (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Label className="text-base font-semibold">Features</Label>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => setFeatures([...features, { title: "New Feature", description: "Description" }])}
        >
          <Plus className="w-4 h-4 mr-1" /> Add Feature
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {features.map((feature, index) => (
          <Card key={index} className="p-3">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Select value={feature.icon || "Zap"} onValueChange={(v) => {
                  const newFeatures = [...features];
                  newFeatures[index] = { ...feature, icon: v };
                  setFeatures(newFeatures);
                }}>
                  <SelectTrigger className="w-28 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map(icon => (
                      <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => {
                  setFeatures(features.filter((_, i) => i !== index));
                }}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <Input
                placeholder="Feature title"
                value={feature.title}
                onChange={(e) => {
                  const newFeatures = [...features];
                  newFeatures[index] = { ...feature, title: e.target.value };
                  setFeatures(newFeatures);
                }}
              />
              <Textarea
                placeholder="Feature description"
                value={feature.description}
                rows={2}
                onChange={(e) => {
                  const newFeatures = [...features];
                  newFeatures[index] = { ...feature, description: e.target.value };
                  setFeatures(newFeatures);
                }}
              />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderLegalSectionsEditor = () => (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Label className="text-base font-semibold text-white">Content Sections</Label>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => setLegalSections([...legalSections, { heading: "New Section", body: "Add content here..." }])}
        >
          <Plus className="w-4 h-4 mr-1" /> Add Section
        </Button>
      </div>
      {legalSections.map((section, index) => (
        <Card key={index} className="p-3">
          <div className="flex items-start gap-2">
            <div className="flex flex-col gap-1 mt-2">
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                if (index > 0) {
                  const newSections = [...legalSections];
                  [newSections[index], newSections[index - 1]] = [newSections[index - 1], newSections[index]];
                  setLegalSections(newSections);
                }
              }}>
                <ArrowUp className="w-3 h-3" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                if (index < legalSections.length - 1) {
                  const newSections = [...legalSections];
                  [newSections[index], newSections[index + 1]] = [newSections[index + 1], newSections[index]];
                  setLegalSections(newSections);
                }
              }}>
                <ArrowDown className="w-3 h-3" />
              </Button>
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Section {index + 1}</Badge>
              </div>
              <Input
                placeholder="Section heading"
                value={section.heading}
                onChange={(e) => {
                  const newSections = [...legalSections];
                  newSections[index] = { ...section, heading: e.target.value };
                  setLegalSections(newSections);
                }}
              />
              <Textarea
                placeholder="Section content..."
                value={section.body}
                rows={4}
                onChange={(e) => {
                  const newSections = [...legalSections];
                  newSections[index] = { ...section, body: e.target.value };
                  setLegalSections(newSections);
                }}
              />
            </div>
            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => {
              setLegalSections(legalSections.filter((_, i) => i !== index));
            }}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );

  const renderFAQsEditor = () => (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Label className="text-base font-semibold text-white">FAQ Items</Label>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => setFaqItems([...faqItems, { question: "New Question?", answer: "Answer here..." }])}
        >
          <Plus className="w-4 h-4 mr-1" /> Add FAQ
        </Button>
      </div>
      {faqItems.map((faq, index) => (
        <Card key={index} className="p-3">
          <div className="flex items-start gap-2">
            <div className="flex flex-col gap-1 mt-2">
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                if (index > 0) {
                  const newItems = [...faqItems];
                  [newItems[index], newItems[index - 1]] = [newItems[index - 1], newItems[index]];
                  setFaqItems(newItems);
                }
              }}>
                <ArrowUp className="w-3 h-3" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                if (index < faqItems.length - 1) {
                  const newItems = [...faqItems];
                  [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
                  setFaqItems(newItems);
                }
              }}>
                <ArrowDown className="w-3 h-3" />
              </Button>
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Q{index + 1}</Badge>
              </div>
              <Input
                placeholder="Question"
                value={faq.question}
                onChange={(e) => {
                  const newItems = [...faqItems];
                  newItems[index] = { ...faq, question: e.target.value };
                  setFaqItems(newItems);
                }}
              />
              <Textarea
                placeholder="Answer..."
                value={faq.answer}
                rows={3}
                onChange={(e) => {
                  const newItems = [...faqItems];
                  newItems[index] = { ...faq, answer: e.target.value };
                  setFaqItems(newItems);
                }}
              />
            </div>
            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => {
              setFaqItems(faqItems.filter((_, i) => i !== index));
            }}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );

  const getSectionLabel = (key: string) => {
    const labels: Record<string, string> = {
      hero: "Hero Banner",
      stats: "Statistics",
      how_it_works: "How It Works",
      features: "Features",
      cta: "Call to Action",
      pricing: "Pricing",
      footer: "Footer",
      privacy_policy: "Privacy Policy",
      terms_of_service: "Terms of Service",
      cookies_policy: "Cookies Policy",
      faqs: "FAQs"
    };
    return labels[key] || key;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Visual Page Editor</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Click any section to edit - just like Elementor!
          </p>
        </div>
        <Button variant="outline" asChild>
          <a href="/" target="_blank" rel="noopener noreferrer">
            <Eye className="w-4 h-4 mr-2" /> View Live Page
          </a>
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Section List */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <LayoutGrid className="w-5 h-5" />
            Page Sections
          </h2>
          
          {sections.map((section, index) => (
            <Card 
              key={section.id}
              className={`cursor-pointer transition-all hover:border-primary ${!section.is_visible ? 'opacity-50' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-1">
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-5 w-5"
                      disabled={index === 0}
                      onClick={(e) => { e.stopPropagation(); moveSection(section, 'up'); }}
                    >
                      <ArrowUp className="w-3 h-3" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-5 w-5"
                      disabled={index === sections.length - 1}
                      onClick={(e) => { e.stopPropagation(); moveSection(section, 'down'); }}
                    >
                      <ArrowDown className="w-3 h-3" />
                    </Button>
                  </div>
                  
                  <div className="flex-1" onClick={() => openEditor(section)}>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{getSectionLabel(section.section_key)}</p>
                      {!section.is_visible && <Badge variant="outline" className="text-xs">Hidden</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {section.title || "No title"}
                    </p>
                  </div>
                  
                  <div className="flex gap-1">
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8"
                      onClick={(e) => { e.stopPropagation(); openEditor(section); }}
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8"
                      onClick={(e) => { e.stopPropagation(); handleToggleVisibility(section); }}
                    >
                      {section.is_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Live Preview */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader className="py-3 border-b">
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye className="w-4 h-4" /> Live Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <iframe
                ref={iframeRef}
                src="/"
                className="w-full h-[600px] border-0"
                title="Landing Page Preview"
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingSection} onOpenChange={(open) => !open && setEditingSection(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5" />
              Edit {editingSection && getSectionLabel(editingSection.section_key)}
            </DialogTitle>
          </DialogHeader>
          
          {editingSection && (
            <Tabs defaultValue="content" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
                <TabsTrigger value="content"><Type className="w-4 h-4 mr-1" /> Content</TabsTrigger>
                <TabsTrigger value="buttons"><Link2 className="w-4 h-4 mr-1" /> Buttons</TabsTrigger>
                <TabsTrigger value="settings"><Settings2 className="w-4 h-4 mr-1" /> Settings</TabsTrigger>
                <TabsTrigger value="html"><Code className="w-4 h-4 mr-1" /> HTML</TabsTrigger>
              </TabsList>
              
              <ScrollArea className="flex-1 mt-4">
                <TabsContent value="content" className="space-y-4 pr-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        value={editingSection.title || ""}
                        onChange={(e) => updateEditingField("title", e.target.value)}
                        placeholder="Section title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Subtitle / Badge</Label>
                      <Input
                        value={editingSection.subtitle || ""}
                        onChange={(e) => updateEditingField("subtitle", e.target.value)}
                        placeholder="Subtitle or badge text"
                      />
                    </div>
                  </div>

                  {/* Section-specific content editors */}
                  {editingSection.section_key === "how_it_works" && renderStepEditor()}
                  {editingSection.section_key === "stats" && renderStatsEditor()}
                  {editingSection.section_key === "features" && renderFeaturesEditor()}
                  {["privacy_policy", "terms_of_service", "cookies_policy"].includes(editingSection.section_key) && renderLegalSectionsEditor()}
                  {editingSection.section_key === "faqs" && renderFAQsEditor()}
                  
                  {/* Generic content for hero/cta */}
                  {["hero", "cta"].includes(editingSection.section_key) && (
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={editingSection.content || ""}
                        onChange={(e) => updateEditingField("content", e.target.value)}
                        placeholder="Section description"
                        rows={4}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Background Image URL</Label>
                    <Input
                      value={editingSection.image_url || ""}
                      onChange={(e) => updateEditingField("image_url", e.target.value)}
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="buttons" className="space-y-4 pr-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Button Text</Label>
                      <Input
                        value={editingSection.button_text || ""}
                        onChange={(e) => updateEditingField("button_text", e.target.value)}
                        placeholder="Click here"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Button URL</Label>
                      <Input
                        value={editingSection.button_url || ""}
                        onChange={(e) => updateEditingField("button_url", e.target.value)}
                        placeholder="/register"
                      />
                    </div>
                  </div>
                  
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <h4 className="font-medium mb-2">Button Preview</h4>
                    <Button variant="gradient">
                      {editingSection.button_text || "Button Text"}
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="settings" className="space-y-4 pr-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <Label>Section Visibility</Label>
                      <p className="text-sm text-muted-foreground">Show or hide this section on the live page</p>
                    </div>
                    <Switch
                      checked={editingSection.is_visible}
                      onCheckedChange={(checked) => updateEditingField("is_visible", checked)}
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="html" className="space-y-4 pr-4">
                  <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm">
                    <strong>Advanced:</strong> Edit raw HTML/JSON content. Be careful with syntax!
                  </div>
                  <Textarea
                    value={htmlContent}
                    onChange={(e) => {
                      setHtmlContent(e.target.value);
                      setEditMode('html');
                    }}
                    className="font-mono text-sm"
                    rows={15}
                    placeholder="Raw content (JSON for steps/stats/features, or plain text)"
                  />
                </TabsContent>
              </ScrollArea>
            </Tabs>
          )}
          
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditingSection(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
