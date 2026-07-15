import NotesEditor from "@/components/NotesEditor";

export const dynamic = "force-dynamic";

export default function NotesPage() {
  return (
    <div className="pb-4">
      <div className="mb-3">
        <h1 className="app-page-title">Notes</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Rich text notes — headings, formatting, images and attachments.
        </p>
      </div>

      <NotesEditor />
    </div>
  );
}
