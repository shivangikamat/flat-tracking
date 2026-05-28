import Link from "next/link";
import { getListings } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

export default function ViewingsPage() {
  const scheduledViewings = getListings()
    .flatMap((listing) =>
      listing.viewings.map((viewing) => ({
        viewing,
        listing,
      })),
    )
    .toSorted(
      (first, second) =>
        first.viewing.startsAt.getTime() - second.viewing.startsAt.getTime(),
    );

  const upcomingViewings = scheduledViewings.filter(
    ({ viewing }) => viewing.startsAt >= new Date(),
  );

  return (
    <main className="app-shell">
      <section className="hero hero-compact">
        <div>
          <p className="eyebrow">Scheduled viewings</p>
          <h1>Every viewing in one calm list.</h1>
          <nav className="page-nav" aria-label="Main navigation">
            <Link href="/">Listings</Link>
            <Link href="/viewings">Scheduled viewings</Link>
          </nav>
        </div>
        <div className="summary-grid" aria-label="Viewing summary">
          <div>
            <span>{upcomingViewings.length}</span>
            <p>upcoming</p>
          </div>
          <div>
            <span>{scheduledViewings.length}</span>
            <p>total scheduled</p>
          </div>
        </div>
      </section>

      {scheduledViewings.length === 0 ? (
        <div className="empty-state">
          <h3>No viewings scheduled yet</h3>
          <p>
            Add viewing times from a listing card and they will appear here.
          </p>
        </div>
      ) : (
        <section className="viewing-list" aria-label="Scheduled viewings">
          {scheduledViewings.map(({ listing, viewing }) => (
            <article className="viewing-card" key={viewing.id}>
              <div>
                <p className="eyebrow">
                  {viewing.startsAt >= new Date() ? "Upcoming" : "Past"}
                </p>
                <h2>{formatDateTime(viewing.startsAt)}</h2>
              </div>
              <div>
                <h3>{listing.title ?? "Untitled listing"}</h3>
                <p className="listing-meta">
                  {listing.area ?? "Area unknown"}
                  {listing.agentName ? ` · ${listing.agentName}` : ""}
                </p>
              </div>
              {viewing.location ? (
                <p>
                  <strong>Location:</strong> {viewing.location}
                </p>
              ) : null}
              {viewing.contactInfo ? (
                <p>
                  <strong>Contact:</strong> {viewing.contactInfo}
                </p>
              ) : null}
              {viewing.notes ? <p>{viewing.notes}</p> : null}
              <a className="source-link" href={listing.sourceUrl} target="_blank">
                Open original listing
              </a>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
