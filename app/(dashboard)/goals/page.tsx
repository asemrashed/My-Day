import GoalsEditor from "@/components/GoalsEditor";

export const dynamic = "force-dynamic";

export default function GoalsPage() {
  return (
    <div className="space-y-6 pb-8">
      <h1 className="app-page-title">Goals</h1>
      <p className="text-muted-foreground text-sm">Create and manage your weekly, monthly or yearly goals.</p>

      <div className="mt-4">
        <GoalsEditor />
      </div>
    </div>
  );
}
