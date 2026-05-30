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

const appletonTower = {
  lat: 55.9446,
  lon: -3.1863,
};

const postcodeDistrictCoordinates: Record<string, { lat: number; lon: number }> = {
  EH1: { lat: 55.9494, lon: -3.1901 },
  EH2: { lat: 55.9525, lon: -3.2034 },
  EH3: { lat: 55.9522, lon: -3.2119 },
  EH4: { lat: 55.9604, lon: -3.2444 },
  EH5: { lat: 55.9736, lon: -3.2187 },
  EH6: { lat: 55.9707, lon: -3.1742 },
  EH7: { lat: 55.9582, lon: -3.1678 },
  EH8: { lat: 55.9446, lon: -3.1668 },
  EH9: { lat: 55.9342, lon: -3.1855 },
  EH10: { lat: 55.9227, lon: -3.2099 },
  EH11: { lat: 55.9368, lon: -3.2292 },
  EH12: { lat: 55.9428, lon: -3.2626 },
  EH13: { lat: 55.9078, lon: -3.2336 },
  EH14: { lat: 55.9135, lon: -3.2843 },
  EH15: { lat: 55.9504, lon: -3.1126 },
  EH16: { lat: 55.9225, lon: -3.1661 },
  EH17: { lat: 55.9049, lon: -3.1598 },
};

type Listing = ReturnType<typeof getListings>[number];

function getListingPostcode(listing: Listing) {
  const haystack = `${listing.title ?? ""} ${listing.area ?? ""}`.toUpperCase();
  const fullPostcode = haystack.match(/\bEH\d{1,2}\s?\d[A-Z]{2}\b/)?.[0];
  const district = haystack.match(/\bEH\d{1,2}\b/)?.[0];

  return {
    full: fullPostcode ? fullPostcode.replace(/\s+/, " ") : null,
    district: district ?? null,
  };
}

function getPostcodeSortValue(listing: Listing) {
  const district = getListingPostcode(listing).district;
  const number = district?.match(/\d+/)?.[0];

  return number ? Number.parseInt(number, 10) : Number.POSITIVE_INFINITY;
}

function getPostcodeGroupLabel(listing: Listing) {
  return getListingPostcode(listing).district ?? "Postcode unknown";
}

function getPostcodeGroupSortValue(label: string) {
  const number = label.match(/\d+/)?.[0];

  return number ? Number.parseInt(number, 10) : Number.POSITIVE_INFINITY;
}

function getRentSortValue(listing: Listing) {
  return listing.rentPcm ?? Number.POSITIVE_INFINITY;
}

function distanceBetweenKm(
  first: { lat: number; lon: number },
  second: { lat: number; lon: number },
) {
  const earthRadiusKm = 6371;
  const latDelta = ((second.lat - first.lat) * Math.PI) / 180;
  const lonDelta = ((second.lon - first.lon) * Math.PI) / 180;
  const firstLat = (first.lat * Math.PI) / 180;
  const secondLat = (second.lat * Math.PI) / 180;
  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(lonDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function estimateAppletonDistanceKm(listing: Listing) {
  const district = getListingPostcode(listing).district;

  if (!district) {
    return Number.POSITIVE_INFINITY;
  }

  const coordinate = postcodeDistrictCoordinates[district];

  if (!coordinate) {
    return Number.POSITIVE_INFINITY;
  }

  return distanceBetweenKm(appletonTower, coordinate);
}

type HomeProps = {
  searchParams?: Promise<{
    sort?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const resolvedSearchParams = await searchParams;
  const sort = resolvedSearchParams?.sort;
  const isRentSort = sort === "rent-asc" || sort === "rent-desc";
  const listings = getListings().toSorted((first, second) => {
    if (sort === "distance") {
      return estimateAppletonDistanceKm(first) - estimateAppletonDistanceKm(second);
    }

    if (sort === "postcode") {
      return (
        getPostcodeSortValue(first) - getPostcodeSortValue(second) ||
        first.title?.localeCompare(second.title ?? "") ||
        0
      );
    }

    if (sort === "rent-asc") {
      return getRentSortValue(first) - getRentSortValue(second);
    }

    if (sort === "rent-desc") {
      return getRentSortValue(second) - getRentSortValue(first);
    }

    return 0;
  });
  const totalImports = getImportCount();
  const upcomingViewings = listings.filter((listing) =>
    listing.viewings.some((viewing) => viewing.startsAt >= new Date()),
  ).length;
  const postcodeGroups = Map.groupBy(listings, getPostcodeGroupLabel)
    .entries()
    .toArray()
    .toSorted(
      ([firstLabel], [secondLabel]) =>
        getPostcodeGroupSortValue(firstLabel) - getPostcodeGroupSortValue(secondLabel) ||
        firstLabel.localeCompare(secondLabel),
    );
  const listingGroups: Array<[string, typeof listings]> = isRentSort
    ? [["All listings by rent", listings]]
    : postcodeGroups;

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
            <div className="sort-controls" aria-label="Sort listings">
              <Link className={!sort ? "active" : ""} href="/">
                Newest
              </Link>
              <Link className={sort === "postcode" ? "active" : ""} href="/?sort=postcode">
                Postcode
              </Link>
              <Link className={sort === "distance" ? "active" : ""} href="/?sort=distance">
                Appleton distance
              </Link>
              <Link className={sort === "rent-asc" ? "active" : ""} href="/?sort=rent-asc">
                Rent low-high
              </Link>
              <Link className={sort === "rent-desc" ? "active" : ""} href="/?sort=rent-desc">
                Rent high-low
              </Link>
            </div>
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
            <div className="postcode-groups">
              {listingGroups.map(([label, groupListings]) => (
                <section className="postcode-section" key={label}>
                  <div className="postcode-heading">
                    <h3>{label}</h3>
                    <span>
                      {groupListings.length}{" "}
                      {groupListings.length === 1 ? "listing" : "listings"}
                    </span>
                  </div>

                  <div className="listing-grid">
                    {groupListings.map((listing) => {
                      const nextViewing = listing.viewings.find(
                        (viewing) => viewing.startsAt >= new Date(),
                      );
                      const postcode = getListingPostcode(listing);
                      const appletonDistanceKm = estimateAppletonDistanceKm(listing);

                      return (
                        <article className="listing-card" key={listing.id}>
                          <div className="listing-topline">
                            <span>{listing.source ?? "Unknown source"}</span>
                            <form action={updateListingStatus}>
                              <input type="hidden" name="id" value={listing.id} />
                              <select name="status" defaultValue={listing.status}>
                                {Object.entries(statusLabels).map(([value, statusLabel]) => (
                                  <option key={value} value={value}>
                                    {statusLabel}
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
                            {postcode.district
                              ? ` · ${postcode.full ?? postcode.district}`
                              : ""}
                            {Number.isFinite(appletonDistanceKm)
                              ? ` · ${appletonDistanceKm.toFixed(1)} km from Appleton Tower`
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
                </section>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
