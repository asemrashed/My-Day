import { auth } from "@/lib/auth";
import Image from "next/image";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import { redirect } from "next/navigation";
import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";
import QuickAddModal from "@/components/QuickAddModal";
import HeaderDate from "@/components/HeaderDate";
import thryveLogo from "@/app/thryve.png";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "ThryveUp | Dashboard",
  description: "Your personal productivity and expense management dashboard.",
  icons: {
    icon: thryveLogo.src,
    shortcut: thryveLogo.src,
    apple: thryveLogo.src,
  },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user;
  return (
    <div className="app-shell">
      {/* Client Sidebar */}
      <div className="hidden md:block">
        <Sidebar user={{ name: user.name, email: user.email, image: user.image }} />
      </div>

      {/* Main Content Area */}
      <div className="dashboard-main">
        {/* Header Bar */}
        <header className="app-header">
          <div className="flex items-center gap-3">
            {/* Mobile Header Logo */}
            <div className="md:hidden h-8 w-8 rounded-lg flex items-center justify-center overflow-hidden bg-primary/10 shadow-lg shadow-primary/25">
              <Image src={thryveLogo} alt="ThryveUp logo" className="h-full w-full object-cover" priority />
            </div>
            <h2 className="text-lg md:text-xl font-bold tracking-tight md:hidden">ThryveUp</h2>
            <div className="hidden md:block">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Workspace</span>
              <p className="text-sm text-muted-foreground font-medium">Personal productivity space</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <HeaderDate />
            <ThemeToggle />
            <NotificationBell />
            <MobileNav />
          </div>
        </header>

        {/* Nested Dashboard Views */}
        <main className="flex-grow min-h-0 flex flex-col p-4 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      <QuickAddModal />
    </div>
  );
}
