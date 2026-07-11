import { lazy, Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import RoleGuard from "@/components/RoleGuard";
import MenteeOnboardingGuard from "@/components/MenteeOnboardingGuard";
import ErrorBoundary from "@/components/ErrorBoundary";
import RouteFallback from "@/components/RouteFallback";
import { queryClient } from "@/lib/queryClient";

const Login = lazy(() => import("@/pages/Login"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const AdminUsers = lazy(() => import("@/pages/AdminUsers"));
const AdminSettings = lazy(() => import("@/pages/AdminSettings"));
const AdminAuditLogs = lazy(() => import("@/pages/AdminAuditLogs"));
const AdminApplications = lazy(() => import("@/pages/AdminApplications"));
const AdminOfferings = lazy(() => import("@/pages/AdminOfferings"));
const AdminPrograms = lazy(() => import("@/pages/AdminPrograms"));
const AdminProgramDetail = lazy(() => import("@/pages/AdminProgramDetail"));
const AdminSessions = lazy(() => import("@/pages/AdminSessions"));
const AdminFeedback = lazy(() => import("@/pages/AdminFeedback"));
const AdminGeneralFeedback = lazy(() => import("@/pages/AdminGeneralFeedback"));
const MentorMentees = lazy(() => import("@/pages/MentorMentees"));
const MentorPrograms = lazy(() => import("@/pages/MentorPrograms"));
const MentorProgramDetail = lazy(() => import("@/pages/MentorProgramDetail"));
const MenteePrograms = lazy(() => import("@/pages/MenteePrograms"));
const MenteeProgramDetail = lazy(() => import("@/pages/MenteeProgramDetail"));
const MentorLanding = lazy(() => import("@/pages/MentorLanding"));
const MentorDirectory = lazy(() => import("@/pages/MentorDirectory"));
const MentorProfile = lazy(() => import("@/pages/MentorProfile"));
const MentorOfferings = lazy(() => import("@/pages/MentorOfferings"));
const OfferingBookings = lazy(() => import("@/pages/OfferingBookings"));
const BookingDetail = lazy(() => import("@/pages/BookingDetail"));
const MentorAvailability = lazy(() => import("@/pages/MentorAvailability"));
const MentorSessions = lazy(() => import("@/pages/MentorSessions"));
const MentorEvents = lazy(() => import("@/pages/MentorEvents"));
const AdminEvents = lazy(() => import("@/pages/AdminEvents"));
const MenteeEvents = lazy(() => import("@/pages/MenteeEvents"));
const MenteeProfile = lazy(() => import("@/pages/MenteeProfile"));
const MenteeOnboarding = lazy(() => import("@/pages/MenteeOnboarding"));
const MenteeSessions = lazy(() => import("@/pages/MenteeSessions"));
const BookSession = lazy(() => import("@/pages/BookSession"));
const SessionFeedback = lazy(() => import("@/pages/SessionFeedback"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const JwtCallback = lazy(() => import("@/pages/JwtCallback"));
const PublicMentorProfile = lazy(() => import("@/pages/PublicMentorProfile"));
const AccountPrivacy = lazy(() => import("@/pages/AccountPrivacy"));
const AdminPrivacyRequests = lazy(() => import("@/pages/AdminPrivacyRequests"));
const MentorLeaderboard = lazy(() => import("@/pages/MentorLeaderboard"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const MenteeBookSession = lazy(() => import("@/pages/MenteeBookSession"));
const MenteeTasks = lazy(() => import("@/pages/MenteeTasks"));
const FeedbackInbox = lazy(() => import("@/pages/FeedbackInbox"));

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <BrandingProvider>
            <AuthProvider>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<Navigate to="/login" replace />} />
                  <Route path="/admin" element={<Navigate to="/admin/applications" replace />} />
                  <Route path="/mentor" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/mentee" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/become-a-mentor" element={<MentorLanding />} />
                  <Route path="/mentors/:mentorId" element={<PublicMentorProfile />} />
                  <Route path="/auth/jwt/callback" element={<JwtCallback />} />
                  <Route path="/admin/applications" element={<RoleGuard allowedRoles={["admin"]}><AdminApplications /></RoleGuard>} />
                  <Route path="/admin/programs" element={<RoleGuard allowedRoles={["admin"]}><AdminPrograms /></RoleGuard>} />
                  <Route path="/admin/programs/:slug" element={<RoleGuard allowedRoles={["admin"]}><AdminProgramDetail /></RoleGuard>} />
                  <Route path="/admin/events" element={<RoleGuard allowedRoles={["admin"]}><AdminEvents /></RoleGuard>} />
                  <Route path="/mentor/mentees" element={<RoleGuard allowedRoles={["mentor"]} requireActiveMentor><MentorMentees /></RoleGuard>} />
                  <Route path="/mentor/programs" element={<RoleGuard allowedRoles={["mentor"]} requireActiveMentor><MentorPrograms /></RoleGuard>} />
                  <Route path="/mentor/programs/:slug" element={<RoleGuard allowedRoles={["mentor"]} requireActiveMentor><MentorProgramDetail /></RoleGuard>} />
                  <Route path="/mentee/programs" element={<RoleGuard allowedRoles={["mentee"]}><MenteeOnboardingGuard><MenteePrograms /></MenteeOnboardingGuard></RoleGuard>} />
                  <Route path="/mentee/programs/:slug" element={<RoleGuard allowedRoles={["mentee"]}><MenteeOnboardingGuard><MenteeProgramDetail /></MenteeOnboardingGuard></RoleGuard>} />
                  <Route path="/mentee/events" element={<RoleGuard allowedRoles={["mentee"]}><MenteeOnboardingGuard><MenteeEvents /></MenteeOnboardingGuard></RoleGuard>} />
                  <Route path="/dashboard" element={<RoleGuard allowedRoles={["admin", "mentor", "mentee"]}><Dashboard /></RoleGuard>} />
                  <Route path="/admin/users" element={<RoleGuard allowedRoles={["admin"]}><AdminUsers /></RoleGuard>} />
                  <Route path="/admin/offerings" element={<RoleGuard allowedRoles={["admin"]}><AdminOfferings /></RoleGuard>} />
                  <Route path="/admin/settings" element={<RoleGuard allowedRoles={["admin"]}><AdminSettings /></RoleGuard>} />
                  <Route path="/admin/sessions" element={<RoleGuard allowedRoles={["admin"]}><AdminSessions /></RoleGuard>} />
                  <Route path="/admin/feedback" element={<RoleGuard allowedRoles={["admin"]}><AdminFeedback /></RoleGuard>} />
                  <Route path="/admin/general-feedback" element={<RoleGuard allowedRoles={["admin"]}><AdminGeneralFeedback /></RoleGuard>} />
                  <Route path="/admin/audit-logs" element={<RoleGuard allowedRoles={["admin"]}><AdminAuditLogs /></RoleGuard>} />
                  <Route path="/admin/privacy-requests" element={<RoleGuard allowedRoles={["admin"]}><AdminPrivacyRequests /></RoleGuard>} />
                  <Route path="/account/privacy" element={<RoleGuard allowedRoles={["admin", "mentor", "mentee"]}><AccountPrivacy /></RoleGuard>} />
                  <Route path="/mentors" element={<RoleGuard allowedRoles={["mentee", "admin"]}><MenteeOnboardingGuard><MentorDirectory /></MenteeOnboardingGuard></RoleGuard>} />
                  <Route path="/mentor/profile" element={<RoleGuard allowedRoles={["mentor"]}><MentorProfile /></RoleGuard>} />
                  <Route path="/mentor/offerings" element={<RoleGuard allowedRoles={["mentor"]}><MentorOfferings /></RoleGuard>} />
                  <Route path="/mentor/offerings/:offeringId/bookings" element={<RoleGuard allowedRoles={["mentor"]}><OfferingBookings /></RoleGuard>} />
                  <Route path="/mentor/offerings/:offeringId/bookings/:bookingId" element={<RoleGuard allowedRoles={["mentor"]}><BookingDetail /></RoleGuard>} />
                  <Route path="/mentor/sessions/:sessionId" element={<RoleGuard allowedRoles={["mentor"]} requireActiveMentor><BookingDetail /></RoleGuard>} />
                  <Route path="/mentor/availability" element={<RoleGuard allowedRoles={["mentor"]} requireActiveMentor><MentorAvailability /></RoleGuard>} />
                  <Route path="/mentor/sessions" element={<RoleGuard allowedRoles={["mentor"]} requireActiveMentor><MentorSessions /></RoleGuard>} />
                  <Route path="/mentor/events" element={<RoleGuard allowedRoles={["mentor"]} requireActiveMentor><MentorEvents /></RoleGuard>} />
                  <Route path="/mentor/leaderboard" element={<RoleGuard allowedRoles={["mentor", "admin"]}><MentorLeaderboard /></RoleGuard>} />
                  <Route path="/onboarding/mentee" element={<RoleGuard allowedRoles={["mentee"]}><MenteeOnboarding /></RoleGuard>} />
                  <Route path="/mentee/profile" element={<RoleGuard allowedRoles={["mentee"]}><MenteeProfile /></RoleGuard>} />
                  <Route path="/mentee/sessions" element={<RoleGuard allowedRoles={["mentee"]}><MenteeOnboardingGuard><MenteeSessions /></MenteeOnboardingGuard></RoleGuard>} />
                  <Route path="/book/:mentorId" element={<RoleGuard allowedRoles={["mentee"]}><MenteeOnboardingGuard><BookSession /></MenteeOnboardingGuard></RoleGuard>} />
                  <Route path="/mentee/book" element={<RoleGuard allowedRoles={["mentee"]}><MenteeOnboardingGuard><MenteeBookSession /></MenteeOnboardingGuard></RoleGuard>} />
                  <Route path="/mentee/tasks" element={<RoleGuard allowedRoles={["mentee"]}><MenteeOnboardingGuard><MenteeTasks /></MenteeOnboardingGuard></RoleGuard>} />
                  <Route path="/session/:id/feedback" element={<RoleGuard allowedRoles={["mentor", "mentee"]}><SessionFeedback /></RoleGuard>} />
                  <Route path="/feedback" element={<RoleGuard allowedRoles={["mentor", "mentee"]}><FeedbackInbox /></RoleGuard>} />
                  <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                  <Route path="/privacy-policy/:version" element={<RoleGuard allowedRoles={["admin"]}><PrivacyPolicy /></RoleGuard>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AuthProvider>
          </BrandingProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
