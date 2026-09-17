import React from "react";

// Test-only identity and routing adapters. Production auth is never bypassed.
const getToken = async () => "test-token";
export const useAuth = () => ({ isLoaded: true, isSignedIn: true, getToken });
export const useUser = () => ({ user: { firstName: "Test", fullName: "Test User" } });
export const SignOutButton = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const usePathname = () => window.location.pathname;
const params = new URLSearchParams(window.location.search);
export const useSearchParams = () => params;
const router = { replace: (url: string) => window.history.replaceState(null, "", url) };
export const useRouter = () => router;
export default function Link(props: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} />;
}

export const auth = Object.assign(async () => ({ userId: null }), { protect: async () => {} });
