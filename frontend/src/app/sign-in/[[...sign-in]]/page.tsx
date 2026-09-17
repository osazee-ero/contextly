import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090B] px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/[0.08] text-sm font-medium text-blue-400">
            C
          </div>

          <h1 className="mt-5 font-serif text-3xl text-zinc-100">
            Welcome back
          </h1>

          <p className="mt-2 text-sm text-zinc-600">
            Sign in to your Contextly workspace.
          </p>
        </div>

        <div className="flex justify-center">
          <SignIn
            path="/sign-in"
            routing="path"
            signUpUrl="/sign-up"
            fallbackRedirectUrl="/dashboard"
          />
        </div>
      </div>
    </main>
  );
}