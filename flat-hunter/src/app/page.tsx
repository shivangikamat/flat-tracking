import {
  addViewing,
  updateListingNotes,
  updateListingStatus,
} from "./actions";
import { getImportCount, getListings, ListingStatus } from "@/lib/db";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const statusLabels: Record<ListingStatus, string> = {
  NEW: "New",
  INTERESTED: "Interested",
  ENQUIRED: "Enquired",
  VIEWING_BOOKED: "Viewing booked",
  VIEWED: "Viewed",
  APPLIED: "Applied",
  REJECTED: "Rejected",
  GONE: "Gone",
  AVOID: "Avoid",
};

function formatRent(rentPcm: number | null) {
  return rentPcm ? `£${rentPcm.toLocaleString("en-GB")} pcm` : "Rent unknown";
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

const postcodeDistanceKm: Record<string, number> = {
  EH1: 0.4,
  EH2: 0.7,
  EH3: 0.9,
  EH7: 1.7,
  EH8: 1.2,
  EH9: 2.4,
  EH10: 3.4,
  EH11: 3.3,
  EH12: 4.5,
  EH13: 5.2,
  EH14: 6.1,
  EH15: 5.0,
  EH16: 4.1,
  EH17: 6.2,
};

const areaDistanceKm: Record<string, number> = {
  leith: 3.0,
  marchmont: 2.2,
  morningside: 3.4,
  newington: 2.0,
  portobello: 6.0,
  stockbridge: 1.8,
};

function estimateDistanceKm(listing: ReturnType<typeof getListings>[number]) {
  const haystack = `${listing.title ?? ""} ${listing.area ?? ""}`.toLowerCase();
  const postcode = haystack.match(/\bEH\d{1,2}\b/i)?.[0]?.toUpperCase();

  if (postcode && postcode in postcodeDistanceKm) {
    return postcodeDistanceKm[postcode];
  }

  for (const [area, distance] of Object.entries(areaDistanceKm)) {
    if (haystack.includes(area)) {
      return distance;
    }
  }

  return Number.POSITIVE_INFINITY;
}

type HomeProps = {
  searchParams?: Promise<{
    sort?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const resolvedSearchParams = await searchParams;
  const sortByDistance = resolvedSearchParams?.sort === "distance";
  const listings = getListings().toSorted((first, second) => {
    if (!sortByDistance) {
      return 0;
    }

    return estimateDistanceKm(first) - estimateDistanceKm(second);
  });
  const totalImports = getImportCount();
  const upcomingViewings = listings.filter((listing) =>
    listing.viewings.some((viewing) => viewing.startsAt >= new Date()),
  ).length;

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Edinburgh rental tracker</p>
          <h1>One place for flats, enquiries, and viewings.</h1>
          <nav className="page-nav" aria-label="Main navigation">
            <Link href="/">Listings</Link>
            <Link href="/viewings">Scheduled viewings</Link>
          </nav>
        </div>
        <div className="summary-grid" aria-label="Tracker summary">
          <div>
            <span>{listings.length}</span>
            <p>listings saved</p>
          </div>
          <div>
            <span>{upcomingViewings}</span>
            <p>viewings coming up</p>
          </div>
          <div>
            <span>{totalImports}</span>
            <p>alert emails imported</p>
          </div>
        </div>
      </section>

      <section className="workspace">
        <section className="listings">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Dashboard</p>
              <h2>Saved listings</h2>
            </div>
            <Link
              className="sort-button"
              href={sortByDistance ? "/" : "/?sort=distance"}
            >
              {sortByDistance ? "Newest first" : "Sort by distance"}
            </Link>
          </div>

          {listings.length === 0 ? (
            <div className="empty-state">
              <h3>No listings yet</h3>
              <p>
                Run the Gmail sync or import alert emails to populate this
                dashboard with real listings.
              </p>
            </div>
          ) : (
            <div className="listing-grid">
              {listings.map((listing) => {
                const nextViewing = listing.viewings.find(
                  (viewing) => viewing.startsAt >= new Date(),
                );

                return (
                  <article className="listing-card" key={listing.id}>
                    <div className="listing-topline">
                      <span>{listing.source ?? "Unknown source"}</span>
                      <form action={updateListingStatus}>
                        <input type="hidden" name="id" value={listing.id} />
                        <select name="status" defaultValue={listing.status}>
                          {Object.entries(statusLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <button type="submit">Update</button>
                      </form>
                    </div>

                    <h3>{listing.title || "Untitled listing"}</h3>
                    <p className="listing-meta">
                      {formatRent(listing.rentPcm)}
                      {listing.area ? ` · ${listing.area}` : ""}
                      {listing.bedrooms !== null
                        ? ` · ${listing.bedrooms} bed`
                        : ""}
                      {Number.isFinite(estimateDistanceKm(listing))
                        ? ` · ~${estimateDistanceKm(listing).toFixed(1)} km`
                        : ""}
                    </p>
                    {listing.agentName ? (
                      <p className="agent-line">
                        {listing.agentName}
                        {listing.agentPhone ? ` · ${listing.agentPhone}` : ""}
                      </p>
                    ) : null}

                    <a className="source-link" href={listing.sourceUrl} target="_blank">
                      Open original listing
                    </a>

                    {nextViewing ? (
                      <p className="viewing-pill">
                        Next viewing: {formatDateTime(nextViewing.startsAt)}
                      </p>
                    ) : null}

                    <form action={updateListingNotes} className="mini-form">
                      <input type="hidden" name="id" value={listing.id} />
                      <label>
                        Notes
                        <textarea
                          name="notes"
                          rows={3}
                          defaultValue={listing.notes ?? ""}
                        />
                      </label>
                      <button type="submit">Save notes</button>
                    </form>

                    <form action={addViewing} className="mini-form viewing-form">
                      <input type="hidden" name="listingId" value={listing.id} />
                      <label>
                        Viewing time
                        <input name="startsAt" type="datetime-local" required />
                      </label>
                      <label>
                        Location
                        <input name="location" placeholder="Address or meeting point" />
                      </label>
                      <label>
                        Contact
                        <input name="contactInfo" placeholder="Email or phone" />
                      </label>
                      <button type="submit">Add viewing</button>
                    </form>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
