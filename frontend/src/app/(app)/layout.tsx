import { auth } from "@clerk/nextjs/server";

import AppSidebar from "../../components/layout/AppSidebar";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await auth.protect();
  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100">
      <AppSidebar />

      <main className="min-h-0 min-w-0 lg:min-h-screen lg:pl-[220px]">
        {children}
      </main>
    </div>
  );
}