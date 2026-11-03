import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/hooks/use-theme";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LiveChat } from "@/components/LiveChat";
import { PwaManifestUpdater } from "@/components/PwaManifestUpdater";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard, { DashboardLayout } from "./pages/Dashboard";
import Wallet from "./pages/Wallet";
import Profile from "./pages/Profile";
import CreateAd from "./pages/CreateAd";
import TaskBrowser from "./pages/TaskBrowser";
import MyAds from "./pages/MyAds";
import Referrals from "./pages/Referrals";
import CheckIn from "./pages/CheckIn";
import Raid from "./pages/Raid";
import Leaderboard from "./pages/Leaderboard";
import Notifications from "./pages/Notifications";
import Wall from "./pages/Wall";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import PaymentCallback from "@/pages/PaymentCallback"; // The file I sent you earlier






// Legal & Info pages
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import CookiesPolicy from "./pages/CookiesPolicy";
import FAQs from "./pages/FAQs";
import ContactUs from "./pages/ContactUs";

// Admin imports (isolated)
import AdminLayout from "./pages/admin/AdminLayout";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminSubmissions from "./pages/admin/AdminSubmissions";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminUserDetail from "./pages/admin/AdminUserDetail";
import AdminCommunications from "./pages/admin/AdminCommunications";
import AdminBroadcast from "./pages/admin/AdminBroadcast";
import AdminAnnouncements from "./pages/admin/AdminAnnouncements";
import AdminEmailCampaigns from "./pages/admin/AdminEmailCampaigns";
import AdminAIConfig from "./pages/admin/AdminAIConfig";
import AdminPrompts from "./pages/admin/AdminPrompts";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminLandingCMS from "./pages/admin/AdminLandingCMS";
import AdminEmailConfig from "./pages/admin/AdminEmailConfig";
import AdminAdsSettings from "./pages/admin/AdminAdsSettings";
import AdminVisualEditor from "./pages/admin/AdminVisualEditor";
import AdminAppSettings from "./pages/admin/AdminAppSettings";
import AdminLiveChats from "./pages/admin/AdminLiveChats";
import AdminModerators from "./pages/admin/AdminModerators";
import Admin2FASettings from "./pages/admin/Admin2FASettings";
import AdminVerify2FA from "./pages/admin/AdminVerify2FA";
import AdminBonusSettings from "./pages/admin/AdminBonusSettings";
import AdminDBDiagnostics from "./pages/admin/AdminDBDiagnostics";
import AdminRaid from "./pages/admin/AdminRaid";
import AdminLeaderboard from "./pages/admin/AdminLeaderboard";
import AdminActivities from "./pages/admin/AdminActivities";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminSettingsPricing from "./pages/admin/AdminSettingsPricing";
import AdminSettingsAppBranding from "./pages/admin/AdminSettingsAppBranding";
import AdminMaintenanceSettings from "./pages/admin/AdminMaintenanceSettings";
import AdminSettingsPaystackPricing from "./pages/admin/AdminSettingsPaystackPricing";
import AdminPaystackSettings from "./pages/admin/AdminPaystackSettings";
import AdminAdsProviderConfig from "./pages/admin/AdminAdsProviderConfig";
import AdminEmailMenu from "./pages/admin/AdminEmailMenu";
import AdminEmailAllowedDomains from "./pages/admin/AdminEmailAllowedDomains";
import AdminEmailTemplates from "./pages/admin/AdminEmailTemplates";
import AdminEmailLogs from "./pages/admin/AdminEmailLogs";
import AdminSettingsAI from "./pages/admin/AdminSettingsAI";
import AdminSettingsBrandingSection from "./pages/admin/AdminSettingsBrandingSection";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Payment callback */}
              <Route path="/payment-callback" element={<PaymentCallback />} />
              
              {/* Legal & Info pages */}
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/cookies" element={<CookiesPolicy />} />
              <Route path="/faqs" element={<FAQs />} />
              <Route path="/contact" element={<ContactUs />} />
              
              {/* User dashboard routes - admins are blocked, must use admin panel */}
              <Route path="/dashboard" element={
                <ProtectedRoute blockAdmins>
                  <DashboardLayout />
                </ProtectedRoute>
              }>
                <Route index element={<Dashboard />} />
                <Route path="wallet" element={<Wallet />} />
                <Route path="profile" element={<Profile />} />
                <Route path="create-ad" element={<CreateAd />} />
                <Route path="tasks" element={<TaskBrowser />} />
                <Route path="my-ads" element={<MyAds />} />
                <Route path="referrals" element={<Referrals />} />
                <Route path="check-in" element={<CheckIn />} />
                <Route path="raid" element={<Raid />} />
                <Route path="leaderboard" element={<Leaderboard />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="wall" element={<Wall />} />
                <Route path="settings" element={<Settings />} />
              </Route>
              
              {/* Hidden admin routes - completely isolated */}
              <Route path="/baki/stage/admin/login" element={<AdminLogin />} />
              <Route path="/baki/stage/admin/verify-2fa" element={<AdminVerify2FA />} />
              <Route path="/baki/stage/admin/db" element={<AdminDBDiagnostics />} />
              <Route path="/baki/stage/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="submissions" element={<AdminSubmissions />} />
<Route path="raid" element={<AdminRaid />} />
              <Route path="leaderboard" element={<AdminLeaderboard />} />
              <Route path="activities" element={<AdminActivities />} />
              <Route path="analytics" element={<AdminAnalytics />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="users/:userId" element={<AdminUserDetail />} />
                <Route path="live-chats" element={<AdminLiveChats />} />
                <Route path="moderators" element={<AdminModerators />} />
                <Route path="communications" element={<AdminCommunications />} />
                <Route path="communications/broadcast" element={<AdminBroadcast />} />
                <Route path="communications/announcements" element={<AdminAnnouncements />} />
                <Route path="communications/email-campaigns" element={<AdminEmailCampaigns />} />
                <Route path="ai-config" element={<AdminAIConfig />} />
                <Route path="prompts" element={<AdminPrompts />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="settings/app-branding" element={<AdminSettingsAppBranding />} />
                <Route path="settings/app-branding/:section" element={<AdminSettingsBrandingSection />} />
                <Route path="settings/app-branding/maintenance" element={<AdminMaintenanceSettings />} />
                <Route path="settings/paystack-pricing" element={<AdminSettingsPaystackPricing />} />
                <Route path="settings/paystack" element={<AdminPaystackSettings />} />
                <Route path="settings/pricing" element={<AdminSettingsPricing />} />
                <Route path="settings/bonus" element={<AdminBonusSettings />} />
                <Route path="settings/ads" element={<AdminAdsSettings />} />
                <Route path="settings/ads/:provider" element={<AdminAdsProviderConfig />} />
                <Route path="settings/email" element={<AdminEmailMenu />} />
                <Route path="settings/email/smtp" element={<AdminEmailConfig />} />
                <Route path="settings/email/domains" element={<AdminEmailAllowedDomains />} />
                <Route path="settings/email/templates" element={<AdminEmailTemplates />} />
                <Route path="settings/email/logs" element={<AdminEmailLogs />} />
                <Route path="settings/2fa" element={<Admin2FASettings />} />
                <Route path="settings/ai" element={<AdminSettingsAI />} />
                <Route path="settings/ai/config" element={<AdminAIConfig />} />
                <Route path="settings/ai/prompts" element={<AdminPrompts />} />
                <Route path="2fa" element={<Admin2FASettings />} />
                <Route path="landing" element={<AdminLandingCMS />} />
                <Route path="visual-editor" element={<AdminVisualEditor />} />
                <Route path="app-settings" element={<AdminAppSettings />} />
                <Route path="email" element={<AdminEmailConfig />} />
                <Route path="ads" element={<AdminAdsSettings />} />
                <Route path="bonus" element={<AdminBonusSettings />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
            
            {/* Global Live Chat */}
            <LiveChat />
            
            {/* Dynamic PWA Manifest from admin settings */}
            <PwaManifestUpdater />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
