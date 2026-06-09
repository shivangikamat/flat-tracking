import Link from "next/link";
import { getImportCount, getListings } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function OptionsPage() {
  const listings = getListings();
  const totalImports = getImportCount();
  const scheduledViewings = listings
    .flatMap((listing) => listing.viewings)
    .toSorted((first, second) => first.startsAt.getTime() - second.startsAt.getTime());
  const upcomingViewings = scheduledViewings.filter(
    (viewing) => viewing.startsAt >= new Date(),
  );
  const nextViewing = upcomingViewings[0];

  return (
    <main className="app-shell">
      <section className="hero hero-compact options-hero">
        <div>
          <p className="eyebrow">Front hall</p>
          <h1>Choose what needs attention next.</h1>
          <nav className="page-nav" aria-label="Main navigation">
            <Link href="/">Front door</Link>
            <Link href="/listings">Listings</Link>
            <Link href="/viewings">Scheduled viewings</Link>
          </nav>
        </div>
        <div className="summary-grid" aria-label="Tracker summary">
          <div>
            <span>{listings.length}</span>
            <p>saved listings</p>
          </div>
          <div>
            <span>{upcomingViewings.length}</span>
            <p>upcoming viewings</p>
          </div>
          <div>
            <span>{totalImports}</span>
            <p>alerts imported</p>
          </div>
        </div>
      </section>

      <section className="option-grid" aria-label="Tracker options">
        <Link className="option-card primary-option" href="/listings">
          <span>Listings</span>
          <h2>Review saved flats</h2>
          <p>Sort by rent, postcode, newest alerts, or distance from Appleton Tower.</p>
        </Link>

        <Link className="option-card" href="/viewings">
          <span>Calendar</span>
          <h2>Plan viewings</h2>
          <p>
            {nextViewing
              ? `Next viewing: ${formatDateTime(nextViewing.startsAt)}`
              : "Add viewing times from listing cards and they will appear here."}
          </p>
        </Link>

        <div className="option-card option-note">
          <span>Email sync</span>
          <h2>Bring in new alerts</h2>
          <p>
            Run <code>npm run sync:gmail</code> in <code>flat-hunter</code> after
            new alert emails arrive in your Gmail label.
          </p>
        </div>

        <div className="option-card option-note">
          <span>Shortcuts</span>
          <h2>Keep the workflow tidy</h2>
          <p>
            Update statuses as you go, add notes after each enquiry, and save viewing
            details before switching back to the calendar.
          </p>
        </div>
      </section>
    </main>
  );
}
