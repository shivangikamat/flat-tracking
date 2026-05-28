import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export function readStore() {
  const filePath = getStorePath();
  if (!existsSync(filePath)) {
    return { listings: [], viewings: [], emailImports: [] };
  }

  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function writeStore(store) {
  writeFileSync(getStorePath(), `${JSON.stringify(store, null, 2)}\n`);
}

function getStorePath() {
  const dataDir = path.join(process.cwd(), "data");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir);
  }

  return path.join(dataDir, "flat-hunter.json");
}

export function decodeHeader(value = "") {
  return value.replace(/=\?UTF-8\?Q\?(.+?)\?=/gi, (_, encoded) =>
    Buffer.from(
      encoded
        .replace(/_/g, " ")
        .replace(/=([0-9A-F]{2})/gi, (_match, hex) =>
          String.fromCharCode(Number.parseInt(hex, 16)),
        ),
      "binary",
    ).toString("utf8"),
  );
}

export function getHeader(raw, name) {
  const match = raw.match(
    new RegExp(`^${name}:\\s*([\\s\\S]*?)(?=\\r?\\n\\S|\\r?\\n\\r?\\n)`, "im"),
  );
  return decodeHeader(match?.[1]?.replace(/\r?\n\s+/g, " ").trim() ?? "");
}

function decodeQuotedPrintable(input) {
  return Buffer.from(
    input
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-F]{2})/gi, (_match, hex) =>
        String.fromCharCode(Number.parseInt(hex, 16)),
      ),
    "binary",
  ).toString("utf8");
}

function getPlainTextPart(raw) {
  const match = raw.match(
    /Content-Transfer-Encoding: quoted-printable\r?\nContent-Type: text\/plain; charset="utf-8"\r?\n\r?\n([\s\S]*?)\r?\n------=/i,
  );

  if (!match) {
    return "";
  }

  return decodeQuotedPrintable(match[1]).replace(/\r\n/g, "\n");
}

function canonicalListingUrl(url) {
  const parsed = new URL(url);
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

function extractAgent(line) {
  const phone = line.match(/(?:0|\+44)\d[\d\s]{8,}\d/)?.[0]?.trim() ?? null;
  const name = phone ? line.replace(phone, "").trim() : line.trim();
  return {
    agentName: name || null,
    agentPhone: phone,
  };
}

function extractArea(title) {
  const location = title.split(" - ")[1];
  if (!location) {
    return null;
  }

  const parts = location
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^EH\d+/i.test(part));

  if (parts.length === 0) {
    return null;
  }

  if (parts.length >= 3) {
    return parts.at(-2) ?? null;
  }

  return parts.at(-1) ?? null;
}

function parseListings(text, subject) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const listings = [];

  for (let index = 0; index < lines.length; index += 1) {
    const priceMatch = lines[index].match(/^£([\d,]+)\s+pcm\b/i);
    const title = lines[index + 1] ?? "";
    const url = lines[index + 2] ?? "";
    const agentLine = lines[index + 3] ?? "";

    if (
      !priceMatch ||
      !title.includes(" to rent - ") ||
      !url.includes("onthemarket.com/details/")
    ) {
      continue;
    }

    const { agentName, agentPhone } = extractAgent(agentLine);
    const bedrooms = title.match(/^(\d+)\s+bedroom/i)?.[1];
    const isReduced = /^Reduced price/i.test(subject);

    listings.push({
      sourceUrl: canonicalListingUrl(url),
      source: "onthemarket.com",
      title,
      rentPcm: Number.parseInt(priceMatch[1].replace(/,/g, ""), 10),
      area: extractArea(title),
      bedrooms: bedrooms ? Number.parseInt(bedrooms, 10) : null,
      bathrooms: null,
      furnished: null,
      agentName,
      agentPhone,
      status: "NEW",
      notes: isReduced ? "Imported from reduced-price alert." : null,
    });
  }

  return listings;
}

export function importRawEmail(store, raw, fallbackMessageId = null) {
  const messageId = getHeader(raw, "Message-ID") || fallbackMessageId;

  if (!messageId) {
    throw new Error("Email is missing a Message-ID and no fallback ID was provided.");
  }

  const existingImport = store.emailImports.find(
    (emailImport) => emailImport.gmailMessageId === messageId,
  );

  if (existingImport) {
    return { messageId, imported: 0, updated: 0, skipped: true };
  }

  const subject = getHeader(raw, "Subject");
  const sender = getHeader(raw, "From");
  const receivedAt = getHeader(raw, "Date");
  const listings = parseListings(getPlainTextPart(raw), subject);
  const now = new Date().toISOString();
  let imported = 0;
  let updated = 0;

  for (const listing of listings) {
    const existing = store.listings.find(
      (item) => item.sourceUrl === listing.sourceUrl,
    );

    if (existing) {
      existing.lastSeenAt = now;
      existing.updatedAt = now;
      existing.rentPcm = listing.rentPcm;
      existing.agentName = listing.agentName;
      existing.agentPhone = listing.agentPhone;
      existing.notes = existing.notes ?? listing.notes;
      updated += 1;
    } else {
      store.listings.push({
        id: randomUUID(),
        ...listing,
        firstSeenAt: now,
        lastSeenAt: null,
        createdAt: now,
        updatedAt: now,
      });
      imported += 1;
    }
  }

  store.emailImports.push({
    id: randomUUID(),
    gmailMessageId: messageId,
    subject,
    sender,
    receivedAt: receivedAt ? new Date(receivedAt).toISOString() : null,
    status: listings.length > 0 ? "IMPORTED" : "SKIPPED",
  });

  return { messageId, imported, updated, skipped: false };
}

export function importEmailFile(store, file) {
  const raw = readFileSync(file, "utf8");
  return importRawEmail(store, raw, path.resolve(file));
}
