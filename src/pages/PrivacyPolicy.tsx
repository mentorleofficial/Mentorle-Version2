import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ShieldCheck, Calendar, Lock } from "lucide-react";
import { formatISTDate } from "@/lib/datetime";
import { useToast } from "@/hooks/use-toast";

interface PolicyData {
  version: string;
  content: string;
  summary: string;
  effective_from: string;
  is_current: boolean;
}

const PrivacyPolicy = () => {
  const { version } = useParams<{ version?: string }>();
  const { role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for auth role to resolve before making access decision
    if (version && !role) return;

    const fetchPolicy = async () => {
      setLoading(true);
      try {
        if (version) {
          if (role !== "admin") {
            toast({
              variant: "destructive",
              title: "Access denied",
              description: "Only admins can view past version history.",
            });
            navigate("/dashboard");
            return;
          }

          const { data, error } = await supabase
            .from("privacy_policy")
            .select("version, content, summary, effective_from, is_current")
            .eq("version", version)
            .single();

          if (error) throw error;
          setPolicy(data as PolicyData);
        } else {
          const { data, error } = await supabase
            .from("privacy_policy")
            .select("version, content, summary, effective_from, is_current")
            .eq("is_current", true)
            .maybeSingle();

          if (error) throw error;
          setPolicy(data as PolicyData | null);
        }
      } catch (e) {
        console.error("Failed to load policy:", e);
        toast({
          variant: "destructive",
          title: "Error loading policy",
          description: "Could not retrieve the privacy policy.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPolicy();
  }, [version, role, navigate, toast]);

  return (
    <AppLayout>
      <div className="max-w-3xl space-y-6">
        {/* Header row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="gap-1.5 -ml-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          </div>

          {version && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Admin — version history
            </Badge>
          )}
        </div>

        {/* Page title */}
        <div>
          <h1 className="font-serif text-2xl flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-primary" />
            Privacy Policy
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {version
              ? `Viewing archived version ${version}`
              : "The current privacy policy for this platform."}
          </p>
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : !policy ? (
          <Card>
            <CardContent className="py-16 text-center space-y-3">
              <ShieldCheck className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="font-medium">No Privacy Policy Configured</p>
              <p className="text-sm text-muted-foreground">
                No active privacy policy version was found. Please check back later or contact an administrator.
              </p>
            </CardContent>
          </Card>
        ) : (
          <article className="space-y-4">
            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Effective {formatISTDate(policy.effective_from)}
              </span>
              <span>·</span>
              <span>Version {policy.version}</span>
              {policy.is_current && (
                <Badge variant="outline" className="text-xs">Current version</Badge>
              )}
            </div>

            {/* Summary card */}
            {policy.summary && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Summary of changes
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-foreground leading-relaxed">
                  {policy.summary}
                </CardContent>
              </Card>
            )}

            {/* Policy content */}
            <Card>
              <CardContent className="p-6 sm:p-8">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{policy.content || "*No content has been added to this policy version.*"}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>

            {/* Admin: link back to current */}
            {version && (
              <p className="text-xs text-muted-foreground text-center">
                This is an archived version.{" "}
                <Link to="/privacy-policy" className="underline">
                  View current policy →
                </Link>
              </p>
            )}
          </article>
        )}
      </div>
    </AppLayout>
  );
};

export default PrivacyPolicy;
