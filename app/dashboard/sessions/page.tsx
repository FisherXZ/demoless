import { redirect } from "next/navigation";
import { SESSIONS } from "@/lib/dashboard/data";

// No empty "select a session" state — open the most recent session directly.
// The list (left rail) stays visible on the detail route for navigation.
export default function SessionsPage() {
  redirect(`/dashboard/sessions/${SESSIONS[0].id}`);
}
