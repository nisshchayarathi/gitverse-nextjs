import Link from "next/link";

export default function AccountDeletedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full text-center px-6 py-12 space-y-6">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
          <svg
            className="w-8 h-8 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            Account Deleted
          </h1>
          <p className="text-muted-foreground">
            Your account and all associated data have been permanently deleted.
          </p>
        </div>

        <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4 text-left space-y-1">
          <p className="font-medium text-foreground mb-2">What was removed:</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Your profile and credentials</li>
            <li>All repositories and analysis data</li>
            <li>Sessions and authentication tokens</li>
            <li>GitHub and OAuth integrations</li>
            <li>Analysis jobs and history</li>
            <li>Password reset tokens</li>
          </ul>
        </div>

        <Link
          href="/signup"
          className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Create a new account
        </Link>
      </div>
    </div>
  );
}