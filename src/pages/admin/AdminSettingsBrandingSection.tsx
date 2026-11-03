import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import AdminAppSettings from "./AdminAppSettings";

export default function AdminSettingsBrandingSection() {
  const { section } = useParams<{ section: string }>();
  const initialTab = ["branding", "seo", "platform", "social"].includes(section || "")
    ? (section as string)
    : "branding";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/baki/stage/admin/settings/app-branding">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">App Settings & Branding</h1>
          <p className="text-sm text-muted-foreground mt-1">Editing {initialTab}</p>
        </div>
      </div>
      <AdminAppSettings initialTab={initialTab} />
    </div>
  );
}