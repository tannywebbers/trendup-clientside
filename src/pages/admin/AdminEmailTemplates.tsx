import { useState, useEffect } from "react";
import { Save, Loader2, RotateCcw, Mail, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsHeader } from "./components/SettingsList";

interface EmailTemplate {
  id?: string;
  key: string;
  name: string;
  subject: string;
  body_html: string;
  is_active: boolean;
  description: string;
  variables: string[];
}

interface EmailTemplateRow {
  key: string;
  subject: string;
  body_html: string;
  is_active: boolean;
}

const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    key: "welcome_email",
    name: "Welcome Email",
    description: "Sent right after a new account is created",
    variables: ["{{name}}", "{{app_name}}"],
    subject: "Welcome to {{app_name}}, {{name}}!",
    body_html:
      "<p>Hi {{name}},</p><p>Welcome to <strong>{{app_name}}</strong>! We're thrilled to have you on board. Start exploring, complete tasks and earn points today.</p><p>Have a great day,<br/>The {{app_name}} Team</p>",
    is_active: true,
  },
  {
    key: "idle_reminder",
    name: "Idle Reminder",
    description: "Sent when a user hasn't been active for a while",
    variables: ["{{name}}", "{{app_name}}"],
    subject: "We miss you, {{name}}!",
    body_html:
      "<p>Hi {{name}},</p><p>It's been a while since you last visited {{app_name}}. New tasks are waiting — come back and keep earning!</p><p>See you soon,<br/>The {{app_name}} Team</p>",
    is_active: true,
  },
  {
    key: "inquiry_reply",
    name: "Inquiry Reply",
    description: "Replies to user support inquiries",
    variables: ["{{name}}", "{{app_name}}", "{{inquiry_subject}}", "{{reply_message}}"],
    subject: "Re: {{inquiry_subject}}",
    body_html:
      "<p>Hi {{name}},</p><p>Thanks for reaching out to {{app_name}}. Here is our reply:</p><blockquote>{{reply_message}}</blockquote><p>If you have any further questions, just hit reply.</p><p>The {{app_name}} Team</p>",
    is_active: true,
  },
  {
    key: "withdraw_received",
    name: "Withdrawal Received",
    description: "Confirms a withdrawal request was received",
    variables: ["{{name}}", "{{app_name}}", "{{amount}}", "{{method}}"],
    subject: "Withdrawal received — {{amount}}",
    body_html:
      "<p>Hi {{name}},</p><p>We've received your withdrawal request of <strong>{{amount}}</strong> via {{method}}. We'll process it within the payout window.</p><p>Thanks,<br/>The {{app_name}} Team</p>",
    is_active: true,
  },
  {
    key: "withdraw_completed",
    name: "Withdrawal Completed",
    description: "Notifies a user their withdrawal was paid out",
    variables: ["{{name}}", "{{app_name}}", "{{amount}}", "{{method}}"],
    subject: "Withdrawal completed — {{amount}}",
    body_html:
      "<p>Hi {{name}},</p><p>Your withdrawal of <strong>{{amount}}</strong> via {{method}} has been completed. Please check your account/address.</p><p>Thanks for being part of {{app_name}}!<br/>The {{app_name}} Team</p>",
    is_active: true,
  },
  {
    key: "withdraw_failed",
    name: "Withdrawal Failed",
    description: "Notifies a user a withdrawal could not be processed",
    variables: ["{{name}}", "{{app_name}}", "{{amount}}", "{{method}}", "{{reason}}"],
    subject: "Withdrawal failed — {{amount}}",
    body_html:
      "<p>Hi {{name}},</p><p>Unfortunately your withdrawal of <strong>{{amount}}</strong> via {{method}} could not be completed: {{reason}}. The funds have been returned to your balance.</p><p>Need help? Just reply to this email.</p><p>The {{app_name}} Team</p>",
    is_active: true,
  },
  {
    key: "deposit_received",
    name: "Deposit Received",
    description: "Confirms a deposit/points purchase was credited",
    variables: ["{{name}}", "{{app_name}}", "{{amount}}", "{{points}}"],
    subject: "Deposit successful — {{amount}}",
    body_html:
      "<p>Hi {{name}},</p><p>Your deposit of <strong>{{amount}}</strong> has been received and <strong>{{points}}</strong> points were credited to your balance. Happy earning!</p><p>The {{app_name}} Team</p>",
    is_active: true,
  },
  {
    key: "post_published",
    name: "Post Published",
    description: "Notifies a user their post went live",
    variables: ["{{name}}", "{{app_name}}", "{{post_title}}"],
    subject: "Your post is live: {{post_title}}",
    body_html:
      "<p>Hi {{name}},</p><p>Great news — your post <strong>\"{{post_title}}\"</strong> is now live on {{app_name}}. Keep sharing!</p><p>The {{app_name}} Team</p>",
    is_active: true,
  },
  {
    key: "checkin_reminder",
    name: "Check-in Reminder",
    description: "Daily streak reminder when a user hasn't checked in",
    variables: ["{{name}}", "{{app_name}}", "{{streak}}", "{{reward}}"],
    subject: "Don't break your {{streak}}-day streak!",
    body_html:
      "<p>Hi {{name}},</p><p>You're on a <strong>{{streak}}-day</strong> check-in streak on {{app_name}}. Check in today to keep it alive and earn <strong>{{reward}}</strong> bonus points!</p><p>See you soon,<br/>The {{app_name}} Team</p>",
    is_active: true,
  },
  {
    key: "checkin_milestone",
    name: "Check-in Milestone",
    description: "Celebrates big check-in streaks",
    variables: ["{{name}}", "{{app_name}}", "{{milestone}}", "{{reward}}"],
    subject: "{{milestone}}-day check-in milestone!",
    body_html:
      "<p>Hi {{name}},</p><p>Congratulations! You just hit a <strong>{{milestone}}-day</strong> check-in milestone on {{app_name}} and earned a <strong>{{reward}}</strong> extra points bonus.</p><p>Keep going!<br/>The {{app_name}} Team</p>",
    is_active: true,
  },
  {
    key: "email_verification",
    name: "Email Verification",
    description: "Sends the 6-digit code for email verification",
    variables: ["{{name}}", "{{code}}", "{{expires_in}}", "{{app_name}}"],
    subject: "Your {{app_name}} verification code",
    body_html:
      "<p>Hi {{name}},</p><p>Your email verification code is:</p><p style=\"font-size:22px;font-weight:bold;letter-spacing:4px\">{{code}}</p><p>This code expires in {{expires_in}}. If you didn't request this, you can safely ignore this email.</p><p>The {{app_name}} Team</p>",
    is_active: true,
  },
];

const VARIABLES_HINT =
  "Available variables: name, app_name, code, amount, method, reason, streak, milestone, reward, expires_in, post_title, inquiry_subject, reply_message — use them as {{variable_name}}.";

export default function AdminEmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selected, setSelected] = useState<EmailTemplate | null>(null);
  const [draft, setDraft] = useState<EmailTemplateRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any).from("email_templates" as any)
        .select("*");
      if (error) throw error;

      const dbRows = new Map((data || []).map((r: any) => [r.key, r]));
      const merged = DEFAULT_TEMPLATES.map((t) => {
        const row = dbRows.get(t.key) as
          | { subject: string; body_html: string; is_active: boolean }
          | undefined;
        if (row) {
          return { ...t, subject: row.subject, body_html: row.body_html, is_active: row.is_active };
        }
        return t;
      });
      setTemplates(merged);
      setSelected(merged[0] || null);
      if (merged[0]) setDraft({ key: merged[0].key, subject: merged[0].subject, body_html: merged[0].body_html, is_active: merged[0].is_active });
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load templates. Run the email migration first." });
      setTemplates(DEFAULT_TEMPLATES);
      setSelected(DEFAULT_TEMPLATES[0] || null);
      if (DEFAULT_TEMPLATES[0]) setDraft({ key: DEFAULT_TEMPLATES[0].key, subject: DEFAULT_TEMPLATES[0].subject, body_html: DEFAULT_TEMPLATES[0].body_html, is_active: DEFAULT_TEMPLATES[0].is_active });
    } finally {
      setIsLoading(false);
    }
  };

  const selectTemplate = (t: EmailTemplate) => {
    setSelected(t);
    setDraft({ key: t.key, subject: t.subject, body_html: t.body_html, is_active: t.is_active });
  };

  const resetToDefault = () => {
    if (!selected) return;
    const def = DEFAULT_TEMPLATES.find((t) => t.key === selected.key);
    if (!def) return;
    setDraft({ key: def.key, subject: def.subject, body_html: def.body_html, is_active: def.is_active });
    toast({ title: "Reset", description: "Editor reset to the default template. Save to persist." });
  };

  const handleSave = async () => {
    if (!draft) return;
    setIsSaving(true);
    try {
      const { data: existing } = await (supabase as any).from("email_templates" as any)
        .select("key")
        .eq("key", draft.key)
        .maybeSingle();

      const payload = {
        key: draft.key,
        subject: draft.subject,
        body_html: draft.body_html,
        is_active: draft.is_active,
      };

      if (existing) {
        const { error } = await (supabase as any).from("email_templates" as any)
          .update(payload)
          .eq("key", draft.key);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("email_templates" as any)
          .insert(payload);
        if (error) throw error;
      }

      setTemplates((prev) =>
        prev.map((t) => (t.key === draft.key ? { ...t, subject: draft.subject, body_html: draft.body_html, is_active: draft.is_active } : t))
      );
      setSelected((prev) => (prev && prev.key === draft.key ? { ...prev, ...payload } : prev));
      toast({ title: "Saved", description: `${draft.key} template updated.` });
    } catch (error) {
      console.error("Error saving template:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to save template." });
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
    <div className="space-y-6">
      <SettingsHeader
        title="Email Templates"
        description="Edit the subject and body of every email TrendUp sends"
        backHref="/baki/stage/admin/settings/email"
      />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Template list */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Templates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {templates.map((t) => (
              <button
                key={t.key}
                onClick={() => selectTemplate(t)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selected?.key === t.key ? "bg-primary/10 text-primary" : "hover:bg-muted"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{t.name}</span>
                  {t.is_active ? (
                    <Eye className="w-3.5 h-3.5 text-green-600 shrink-0" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.description}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Editor */}
        {selected && draft && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle>{selected.name}</CardTitle>
                  <CardDescription>{selected.description}</CardDescription>
                </div>
                <Badge variant="outline" className="font-mono text-xs">{selected.key}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Active</Label>
                  <p className="text-xs text-muted-foreground">Only active templates are sent</p>
                </div>
                <Switch
                  checked={draft.is_active}
                  onCheckedChange={(checked) => setDraft({ ...draft, is_active: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label>Subject line</Label>
                <Input
                  value={draft.subject}
                  onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Email body (HTML)</Label>
                <Textarea
                  value={draft.body_html}
                  onChange={(e) => setDraft({ ...draft, body_html: e.target.value })}
                  className="font-mono text-sm min-h-[260px]"
                />
              </div>

              <div className="p-3 rounded-lg bg-muted/50 border text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5 font-medium text-foreground mb-1">
                  <Mail className="w-3.5 h-3.5" /> {VARIABLES_HINT}
                </p>
                <p>Emails are wrapped in the app's branded layout automatically, so paste the inner content only. Every email includes a tracking pixel for the delivery logs.</p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetToDefault}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset to Default
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Template
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}