import { LoginLink } from '@kinde-oss/kinde-auth-nextjs/components';

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl font-bold">LeedsBot — Prototype</h1>
      <p className="mt-2">Sign in with your email. First time: you’ll complete your profile. Next time: straight to the dashboard.</p>
      <div className="mt-6">
        <LoginLink postLoginRedirectURL="/dashboard" className="rounded border px-4 py-2">
          Sign in
        </LoginLink>
      </div>
    </main>
  );
}
