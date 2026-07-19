import { redirect } from "next/navigation";

/**
 * Root route → redirect to Chat (the main interface).
 * The old landing page content is now accessible at /about if needed.
 */
export default function RootPage() {
  redirect("/chat");
}
 
