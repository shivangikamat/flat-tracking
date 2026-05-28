import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const listingStatuses = [
  "NEW",
  "INTERESTED",
  "ENQUIRED",
  "VIEWING_BOOKED",
  "VIEWED",
  "APPLIED",
  "REJECTED",
  "GONE",
  "AVOID",
] as const;

export type ListingStatus = (typeof listingStatuses)[number];

export type Listing = {
  id: string;
  sourceUrl: string;
  source: string | null;
  title: string | null;
  rentPcm: number | null;
  area: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  furnished: string | null;
  status: ListingStatus;
  notes: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  viewings: Viewing[];
};

export type Viewing = {
  id: string;
  listingId: string;
  startsAt: Date;
  location: string | null;
  contactName: string | null;
  contactInfo: string | null;
  notes: string | null;
  outcome: string | null;
};

type StoredListing = Omit<
  Listing,
  "firstSeenAt" | "lastSeenAt" | "createdAt" | "updatedAt" | "viewings"
> & {
  firstSeenAt: string;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type StoredViewing = Omit<Viewing, "startsAt"> & {
  startsAt: string;
};

type Store = {
  listings: StoredListing[];
  viewings: StoredViewing[];
  emailImports: {
    id: string;
    gmailMessageId: string;
    status: string;
  }[];
};

const emptyStore: Store = {
  listings: [],
  viewings: [],
  emailImports: [],
};

function storePath() {
  const dataDir = path.join(process.cwd(), "data");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir);
  }

  return path.join(dataDir, "flat-hunter.json");
}

function readStore(): Store {
  const filePath = storePath();
  if (!existsSync(filePath)) {
    writeStore(emptyStore);
    return structuredClone(emptyStore);
  }

  return JSON.parse(readFileSync(filePath, "utf8")) as Store;
}

function writeStore(store: Store) {
  writeFileSync(storePath(), `${JSON.stringify(store, null, 2)}\n`);
}

function toListing(listing: StoredListing, viewings: StoredViewing[]): Listing {
  return {
    ...listing,
    firstSeenAt: new Date(listing.firstSeenAt),
    lastSeenAt: listing.lastSeenAt ? new Date(listing.lastSeenAt) : null,
    createdAt: new Date(listing.createdAt),
    updatedAt: new Date(listing.updatedAt),
    viewings: viewings.map((viewing) => ({
      ...viewing,
      startsAt: new Date(viewing.startsAt),
    })),
  };
}

export function getListings() {
  const store = readStore();

  return store.listings
    .toSorted(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .map((listing) =>
      toListing(
        listing,
        store.viewings
          .filter((viewing) => viewing.listingId === listing.id)
          .toSorted(
            (a, b) =>
              new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
          ),
      ),
    );
}

export function getImportCount() {
  return readStore().emailImports.length;
}

export function createListing(input: {
  sourceUrl: string;
  source: string | null;
  title: string | null;
  rentPcm: number | null;
  area: string | null;
  bedrooms: number | null;
  notes: string | null;
}) {
  const store = readStore();
  const existing = store.listings.find(
    (listing) => listing.sourceUrl === input.sourceUrl,
  );
  const now = new Date().toISOString();

  if (existing) {
    existing.lastSeenAt = now;
    existing.updatedAt = now;
  } else {
    store.listings.push({
      id: randomUUID(),
      sourceUrl: input.sourceUrl,
      source: input.source,
      title: input.title,
      rentPcm: input.rentPcm,
      area: input.area,
      bedrooms: input.bedrooms,
      bathrooms: null,
      furnished: null,
      status: "NEW",
      notes: input.notes,
      firstSeenAt: now,
      lastSeenAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  writeStore(store);
}

export function setListingStatus(id: string, status: ListingStatus) {
  const store = readStore();
  const listing = store.listings.find((item) => item.id === id);

  if (listing) {
    listing.status = status;
    listing.updatedAt = new Date().toISOString();
    writeStore(store);
  }
}

export function setListingNotes(id: string, notes: string | null) {
  const store = readStore();
  const listing = store.listings.find((item) => item.id === id);

  if (listing) {
    listing.notes = notes;
    listing.updatedAt = new Date().toISOString();
    writeStore(store);
  }
}

export function createViewing(input: {
  listingId: string;
  startsAt: Date;
  location: string | null;
  contactName: string | null;
  contactInfo: string | null;
  notes: string | null;
}) {
  const store = readStore();

  store.viewings.push({
    id: randomUUID(),
    listingId: input.listingId,
    startsAt: input.startsAt.toISOString(),
    location: input.location,
    contactName: input.contactName,
    contactInfo: input.contactInfo,
    notes: input.notes,
    outcome: null,
  });

  const listing = store.listings.find((item) => item.id === input.listingId);
  if (listing) {
    listing.status = "VIEWING_BOOKED";
    listing.updatedAt = new Date().toISOString();
  }

  writeStore(store);
}
