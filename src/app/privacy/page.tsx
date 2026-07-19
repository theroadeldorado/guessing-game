import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy | ShadowForm',
  description:
    'ShadowForm barely touches your data: no account, no personal information, no cookies. Here is the short version.',
}

const EFFECTIVE_DATE = 'July 18, 2026'

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 px-4 py-10">
      <header className="border-b border-chalk pb-4">
        <Link
          href="/"
          className="font-display text-2xl uppercase tracking-wide text-paper transition-colors hover:text-flag"
        >
          Shadow<span className="text-flag">Form</span>
        </Link>
        <h1 className="mt-4 font-display text-3xl uppercase text-paper">Privacy Policy</h1>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.3em] text-chalk-soft">
          Effective {EFFECTIVE_DATE}
        </p>
      </header>

      <div className="flex flex-col gap-7 text-sm leading-relaxed text-chalk-soft">
        <p>
          ShadowForm is a free golf guessing game. There isn&apos;t much to put on this page,
          because the game barely touches your data. There&apos;s no account, no sign-up, and no
          cookies.
        </p>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-xl uppercase text-paper">What we collect</h2>
          <p>
            Nothing about you personally. There&apos;s no login and no forms anywhere in the game, so
            your name and email never reach us in the first place.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-xl uppercase text-paper">Analytics</h2>
          <p>
            We use Vercel Web Analytics to see roughly how many people are playing and which pages
            get visited. It doesn&apos;t set cookies and it doesn&apos;t follow you around other
            sites. Rather than track individuals, it counts visits with an anonymized hash that
            resets regularly, and it drops your IP address. All we ever see are totals.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-xl uppercase text-paper">Game data on your device</h2>
          <p>
            Your best score and your Daily Round streak are saved in your browser so the game
            remembers them between visits. That&apos;s the whole of it, and none of it leaves your
            device. If you&apos;d rather it were gone, clearing your browser&apos;s data for the site
            wipes it.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-xl uppercase text-paper">Cookies</h2>
          <p>
            None. No tracking cookies, no advertising cookies, nothing that would need a consent
            pop-up.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-xl uppercase text-paper">Sharing your data</h2>
          <p>
            We don&apos;t sell or share anything, mostly because there&apos;s nothing to sell or
            share. The only outside company involved is Vercel, which hosts the game and runs the
            analytics described above.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-xl uppercase text-paper">Children</h2>
          <p>
            The game is made for a general audience, not aimed at kids under 13. Since we collect no
            personal information from anyone, we don&apos;t collect it from children either.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-xl uppercase text-paper">Your choices</h2>
          <p>
            There&apos;s no account to manage and no data of yours sitting on a server somewhere, so
            there&apos;s nothing to request or delete on our end. The only saved data lives in your
            browser, and it&apos;s yours to clear whenever you want.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-xl uppercase text-paper">Changes</h2>
          <p>
            If the way the game handles data ever changes, we&apos;ll update this page and change the
            date at the top.
          </p>
        </section>
      </div>

      <footer className="border-t border-chalk pt-4">
        <Link
          href="/"
          className="font-mono text-xs uppercase tracking-[0.2em] text-chalk-soft transition-colors hover:text-flag"
        >
          &larr; Back to ShadowForm
        </Link>
      </footer>
    </main>
  )
}
