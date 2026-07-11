import AppLayout from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BrandingSettings from "@/components/admin/BrandingSettings";
import JwtSettings from "@/components/admin/JwtSettings";
import PrivacySettings from "@/components/admin/PrivacySettings";
import EdubridgeSettings from "@/components/admin/EdubridgeSettings";
import ApplicationPolicySettings from "@/components/admin/ApplicationPolicySettings";

const AdminSettings = () => {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-2xl">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Customize your platform's appearance, authentication, privacy, and integrations.</p>
        </div>
        <Tabs defaultValue="branding">
          <TabsList className="w-full sm:w-auto justify-start overflow-x-auto flex [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <TabsTrigger value="branding" className="shrink-0">Branding</TabsTrigger>
            <TabsTrigger value="jwt" className="shrink-0">SSO / JWT</TabsTrigger>
            <TabsTrigger value="privacy" className="shrink-0">Privacy</TabsTrigger>
            <TabsTrigger value="edubridge" className="shrink-0">EduBridge</TabsTrigger>
            <TabsTrigger value="applications" className="shrink-0">Applications</TabsTrigger>
          </TabsList>
          <TabsContent value="branding" className="mt-6"><BrandingSettings /></TabsContent>
          <TabsContent value="jwt" className="mt-6"><JwtSettings /></TabsContent>
          <TabsContent value="privacy" className="mt-6"><PrivacySettings /></TabsContent>
          <TabsContent value="edubridge" className="mt-6"><EdubridgeSettings /></TabsContent>
          <TabsContent value="applications" className="mt-6"><ApplicationPolicySettings /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default AdminSettings;

