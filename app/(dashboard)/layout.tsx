import { auth, signOut } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import { redirect } from "next/navigation";
import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";
import QuickAddModal from "@/components/QuickAddModal";
import { 
  LogOut, 
} from "lucide-react";

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
            <div className="md:hidden h-8 w-8 rounded-lg flex items-center justify-center font-bold bg-primary text-primary-foreground shadow-lg shadow-primary/25">
              MD
            </div>
            <h2 className="text-lg md:text-xl font-bold tracking-tight md:hidden">MyDay</h2>
            <div className="hidden md:block">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Workspace</span>
              <p className="text-sm text-muted-foreground font-medium">Personal productivity space</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <NotificationBell />
            
            {/* Mobile Log Out Section */}
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
              className="md:hidden"
            >
              <button
                type="submit"
                className="app-icon-button hover:text-destructive"
                title="Log Out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </form>
          </div>
        </header>

        {/* Nested Dashboard Views */}
        <main className="flex-grow p-4 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      <QuickAddModal />

      {/* Mobile Bottom Navigation Bar (Hidden on Large Screen) */}
      <MobileNav />
    </div>
  );
}
