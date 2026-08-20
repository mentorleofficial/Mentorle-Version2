import { Navigate, useParams } from "react-router-dom";

/**
 * Legacy plural URLs (`/mentors/:id`) redirect to the canonical
 * singular public profile path (`/mentor/:slug`). UUID → pretty-slug
 * canonicalization happens inside PublicMentorProfile.
 */
const LegacyPublicMentorRedirect = () => {
  const { mentorId } = useParams<{ mentorId: string }>();
  if (!mentorId) return <Navigate to="/" replace />;
  return <Navigate to={`/mentor/${mentorId}`} replace />;
};

export default LegacyPublicMentorRedirect;
