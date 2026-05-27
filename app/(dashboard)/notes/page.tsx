import NotesEditor from "@/components/NotesEditor";

export const dynamic = "force-dynamic";

export default function NotesPage() {
  return (
    <div className="space-y-6 pb-8">
      <h1 className="app-page-title">Notes</h1>
      <p className="text-muted-foreground text-sm">Rich text notes — headings, formatting, images and attachments.</p>

      <div className="mt-4">
        <NotesEditor />
      </div>
    </div>
  );
}
