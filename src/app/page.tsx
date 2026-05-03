import { EntryBackground } from "@/components/entry/EntryBackground";
import { RepoInputForm } from "@/components/entry/RepoInputForm";
import { AuthStatus } from "@/components/auth/AuthStatus";
import { Logo } from "@/components/ui/Logo";

export default function EntryPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-6">
      <EntryBackground />
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <h1 className="mb-2 text-center text-4xl font-bold tracking-tight">GitMetro</h1>
        <p className="mb-8 text-center text-sm text-muted">
          Turn any GitHub repository into a readable metro map.
        </p>
        <RepoInputForm />
        <AuthStatus variant="entry" returnTo="/" showRefresh={false} />
      </div>
    </main>
  );
}
