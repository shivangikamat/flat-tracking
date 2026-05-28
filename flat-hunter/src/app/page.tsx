import {
  addListing,
  addViewing,
  updateListingNotes,
  updateListingStatus,
} from "./actions";
import { getImportCount, getListings, ListingStatus } from "@/lib/db";

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

export default async function Home() {
  const listings = getListings();
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
        <aside className="panel">
          <h2>Add a real listing</h2>
          <form action={addListing} className="stack">
            <label>
              Listing URL
              <input
                name="sourceUrl"
                type="url"
                placeholder="https://..."
                required
              />
            </label>
            <label>
              Title or address
              <input name="title" placeholder="Leave blank if unknown" />
            </label>
            <div className="field-row">
              <label>
                Rent pcm
                <input name="rentPcm" type="number" min="0" inputMode="numeric" />
              </label>
              <label>
                Bedrooms
                <input name="bedrooms" type="number" min="0" inputMode="numeric" />
              </label>
            </div>
            <label>
              Area
              <input name="area" placeholder="Leith, Marchmont, Newington..." />
            </label>
            <label>
              Source
              <input name="source" placeholder="Auto-detected from URL if blank" />
            </label>
            <label>
              Notes
              <textarea name="notes" rows={4} placeholder="Deposit, move date, red flags..." />
            </label>
            <button type="submit">Save listing</button>
          </form>

          <div className="import-note">
            <h2>Email importer</h2>
            <p>
              Ready for the Gmail connection. It will read only your filtered
              property alert label once you provide OAuth credentials.
            </p>
          </div>
        </aside>

        <section className="listings">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Dashboard</p>
              <h2>Saved listings</h2>
            </div>
          </div>

          {listings.length === 0 ? (
            <div className="empty-state">
              <h3>No listings yet</h3>
              <p>
                Add your first real listing URL, or send me a few exported alert
                emails and I’ll build the parser against those samples.
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
