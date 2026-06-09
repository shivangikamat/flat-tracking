import Link from "next/link";
import { getListings } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(date);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeStyle: "short",
  }).format(date);
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseMonth(value: string | undefined, fallback: Date) {
  if (!value) {
    return new Date(fallback.getFullYear(), fallback.getMonth(), 1);
  }

  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return new Date(fallback.getFullYear(), fallback.getMonth(), 1);
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10) - 1;
  return new Date(year, month, 1);
}

function buildCalendarDays(month: Date) {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
  const startDate = new Date(firstOfMonth);
  startDate.setDate(firstOfMonth.getDate() - firstWeekday);

  return Array.from({ length: 42 }, (_item, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    return date;
  });
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

type ViewingsPageProps = {
  searchParams?: Promise<{
    month?: string;
  }>;
};

export default async function ViewingsPage({ searchParams }: ViewingsPageProps) {
  const resolvedSearchParams = await searchParams;
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
  const firstUpcomingDate = upcomingViewings[0]?.viewing.startsAt ?? new Date();
  const visibleMonth = parseMonth(resolvedSearchParams?.month, firstUpcomingDate);
  const previousMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
  const nextMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
  const calendarDays = buildCalendarDays(visibleMonth);
  const viewingsByDay = Map.groupBy(scheduledViewings, ({ viewing }) =>
    dayKey(viewing.startsAt),
  );
  const visibleMonthViewings = scheduledViewings.filter(
    ({ viewing }) =>
      viewing.startsAt.getFullYear() === visibleMonth.getFullYear() &&
      viewing.startsAt.getMonth() === visibleMonth.getMonth(),
  );

  return (
    <main className="app-shell">
      <section className="hero hero-compact">
        <div>
          <p className="eyebrow">Scheduled viewings</p>
          <h1>Your viewings, laid out by date.</h1>
          <nav className="page-nav" aria-label="Main navigation">
            <Link href="/">Front door</Link>
            <Link href="/options">Options</Link>
            <Link href="/listings">Listings</Link>
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

      <section className="calendar-shell" aria-label="Viewing calendar">
        <div className="calendar-toolbar">
          <div>
            <p className="eyebrow">Calendar</p>
            <h2>{formatMonth(visibleMonth)}</h2>
          </div>
          <div className="calendar-nav">
            <Link href={`/viewings?month=${monthKey(previousMonth)}`}>Previous</Link>
            <Link href="/viewings">Today</Link>
            <Link href={`/viewings?month=${monthKey(nextMonth)}`}>Next</Link>
          </div>
        </div>

        <div className="calendar-grid" role="grid">
          {dayLabels.map((day) => (
            <div className="calendar-weekday" key={day}>
              {day}
            </div>
          ))}

          {calendarDays.map((date) => {
            const events = viewingsByDay.get(dayKey(date)) ?? [];
            const isCurrentMonth = date.getMonth() === visibleMonth.getMonth();
            const isToday = dayKey(date) === dayKey(new Date());

            return (
              <div
                className={[
                  "calendar-day",
                  isCurrentMonth ? "" : "muted",
                  isToday ? "today" : "",
                ].join(" ")}
                key={dayKey(date)}
              >
                <div className="calendar-date">
                  <span>{date.getDate()}</span>
                  {events.length > 0 ? <strong>{events.length}</strong> : null}
                </div>

                <div className="calendar-events">
                  {events.map(({ listing, viewing }) => (
                    <a
                      className="calendar-event"
                      href={listing.sourceUrl}
                      key={viewing.id}
                      target="_blank"
                    >
                      <span>{formatTime(viewing.startsAt)}</span>
                      <strong>{listing.area ?? "Viewing"}</strong>
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {scheduledViewings.length === 0 ? (
        <div className="empty-state">
          <h3>No viewings scheduled yet</h3>
          <p>Add viewing times from a listing card and they will appear here.</p>
        </div>
      ) : visibleMonthViewings.length > 0 ? (
        <section className="viewing-list" aria-label="Viewing details">
          {visibleMonthViewings.map(({ listing, viewing }) => (
            <article className="viewing-card" key={viewing.id}>
              <div>
                <p className="eyebrow">
                  {viewing.startsAt >= new Date() ? "Upcoming" : "Past"}
                </p>
                <h2>
                  {formatDate(viewing.startsAt)} at {formatTime(viewing.startsAt)}
                </h2>
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
      ) : (
        <div className="empty-state">
          <h3>No viewings in {formatMonth(visibleMonth)}</h3>
          <p>Use the month controls to browse scheduled viewings.</p>
        </div>
      )}
    </main>
  );
}
