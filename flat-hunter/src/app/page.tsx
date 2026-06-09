import Link from "next/link";
import { getImportCount, getListings } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function Home() {
  const listings = getListings();
  const totalImports = getImportCount();
  const upcomingViewings = listings.filter((listing) =>
    listing.viewings.some((viewing) => viewing.startsAt >= new Date()),
  ).length;

  return (
    <main className="front-door-page">
      <section className="house-entry" aria-labelledby="front-door-title">
        <div className="entry-copy">
          <p className="eyebrow">Flat Tracking</p>
          <h1 id="front-door-title">Come in and sort the flat hunt.</h1>
          <p>
            Your saved listings, scheduled viewings, and alert imports are tucked
            behind the front door.
          </p>
        </div>

        <div className="house-stage" aria-label="Flat Tracking house entrance">
          <div className="house-sky" />
          <div className="house">
            <div className="roof" />
            <div className="chimney" />
            <div className="house-body">
              <div className="window window-left">
                <span />
                <span />
              </div>
              <div className="window window-right">
                <span />
                <span />
              </div>
              <Link
                className="house-door"
                href="/options"
                aria-label="Open the door to Flat Tracking options"
              >
                <span className="door-knob" />
                <strong>Enter</strong>
              </Link>
            </div>
          </div>
          <div className="garden-path" />
        </div>

        <div className="entry-stats" aria-label="Tracker summary">
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
    </main>
  );
}
