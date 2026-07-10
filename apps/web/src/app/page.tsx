import { getWebEnv } from '@/env';

export default function HomePage() {
  const env = getWebEnv();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-widest text-brand-purple">MVP foundation</p>
      <h1 className="font-display text-4xl font-semibold text-brand-ink md:text-5xl">
        {env.NEXT_PUBLIC_PLATFORM_DISPLAY_NAME}
      </h1>
      <p className="text-lg text-brand-ink/80">
        Chapter 1 complete — monorepo, API health checks, and web shell are wired. Business features
        begin in Chapter 2.
      </p>
    </main>
  );
}
