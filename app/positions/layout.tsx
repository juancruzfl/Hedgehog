import { requireSignIn } from "@/lib/auth/guard";

// Signed-in users only (lib/auth/guard.ts).
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireSignIn("/positions");
  return children;
}
