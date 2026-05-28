"use server";

import { revalidatePath } from "next/cache";
import {
  createListing,
  createViewing,
  listingStatuses,
  setListingNotes,
  setListingStatus,
} from "@/lib/db";

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function optionalNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSource(sourceUrl: string) {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export async function addListing(formData: FormData) {
  const sourceUrl = optionalString(formData.get("sourceUrl"));

  if (!sourceUrl) {
    return;
  }

  createListing({
    sourceUrl,
    source: optionalString(formData.get("source")) ?? parseSource(sourceUrl),
    title: optionalString(formData.get("title")),
    rentPcm: optionalNumber(formData.get("rentPcm")),
    area: optionalString(formData.get("area")),
    bedrooms: optionalNumber(formData.get("bedrooms")),
    notes: optionalString(formData.get("notes")),
  });

  revalidatePath("/");
}

export async function updateListingStatus(formData: FormData) {
  const id = optionalString(formData.get("id"));
  const status = optionalString(formData.get("status"));

  if (!id || !status || !listingStatuses.includes(status as never)) {
    return;
  }

  setListingStatus(id, status as never);

  revalidatePath("/");
}

export async function updateListingNotes(formData: FormData) {
  const id = optionalString(formData.get("id"));

  if (!id) {
    return;
  }

  setListingNotes(id, optionalString(formData.get("notes")));

  revalidatePath("/");
}

export async function addViewing(formData: FormData) {
  const listingId = optionalString(formData.get("listingId"));
  const startsAt = optionalString(formData.get("startsAt"));

  if (!listingId || !startsAt) {
    return;
  }

  createViewing({
    listingId,
    startsAt: new Date(startsAt),
    location: optionalString(formData.get("location")),
    contactName: optionalString(formData.get("contactName")),
    contactInfo: optionalString(formData.get("contactInfo")),
    notes: optionalString(formData.get("notes")),
  });

  revalidatePath("/");
}
