import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { importRawEmail, readStore, writeStore } from "./lib/alert-importer.mjs";

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];
const LABEL_NAME = process.env.GMAIL_LABEL_NAME ?? "Flat Alerts";
const SECRETS_DIR = path.join(process.cwd(), "secrets");
const CREDENTIALS_PATH = path.join(SECRETS_DIR, "google-oauth.json");
const TOKEN_PATH = path.join(SECRETS_DIR, "gmail-token.json");

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  if (!existsSync(path.dirname(filePath))) {
    mkdirSync(path.dirname(filePath));
  }

  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readCredentials() {
  if (!existsSync(CREDENTIALS_PATH)) {
    throw new Error(`Missing OAuth credentials at ${CREDENTIALS_PATH}`);
  }

  const credentials = readJson(CREDENTIALS_PATH);
  const client = credentials.installed ?? credentials.web;

  if (!client?.client_id || !client?.client_secret) {
    throw new Error("OAuth credentials JSON is missing client_id/client_secret.");
  }

  return {
    clientId: client.client_id,
    clientSecret: client.client_secret,
  };
}

async function postForm(url, form) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(form),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error_description ?? body.error ?? response.statusText);
  }

  return body;
}

async function fetchJson(url, accessToken) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error?.message ?? response.statusText);
  }

  return body;
}

function waitForOAuthCallback(server, expectedState) {
  return new Promise((resolve, reject) => {
    server.on("request", (request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");

      if (url.pathname !== "/oauth2callback") {
        response.writeHead(404);
        response.end("Not found");
        return;
      }

      const state = url.searchParams.get("state");
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        response.writeHead(400, { "Content-Type": "text/plain" });
        response.end(`Authorization failed: ${error}`);
        reject(new Error(error));
        return;
      }

      if (!code || state !== expectedState) {
        response.writeHead(400, { "Content-Type": "text/plain" });
        response.end("Authorization failed: invalid callback.");
        reject(new Error("Invalid OAuth callback."));
        return;
      }

      response.writeHead(200, { "Content-Type": "text/plain" });
      response.end("Flat Hunter Gmail sync is authorized. You can close this tab.");
      resolve(code);
    });
  });
}

async function authorize(credentials) {
  if (existsSync(TOKEN_PATH)) {
    const token = readJson(TOKEN_PATH);

    if (token.expires_at && token.expires_at > Date.now() + 60_000) {
      return token.access_token;
    }

    if (token.refresh_token) {
      const refreshed = await postForm("https://oauth2.googleapis.com/token", {
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        refresh_token: token.refresh_token,
        grant_type: "refresh_token",
      });

      const nextToken = {
        ...token,
        access_token: refreshed.access_token,
        expires_at: Date.now() + refreshed.expires_in * 1000,
      };
      writeJson(TOKEN_PATH, nextToken);
      return nextToken.access_token;
    }
  }

  const state = randomBytes(18).toString("hex");
  const server = createServer();

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  const redirectUri = `http://127.0.0.1:${address.port}/oauth2callback`;
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.search = new URLSearchParams({
    client_id: credentials.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  }).toString();

  console.log("Open this URL in your browser to authorize Gmail read-only sync:");
  console.log(authUrl.toString());

  try {
    const code = await waitForOAuthCallback(server, state);
    const token = await postForm("https://oauth2.googleapis.com/token", {
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });

    const storedToken = {
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      scope: token.scope,
      token_type: token.token_type,
      expires_at: Date.now() + token.expires_in * 1000,
    };
    writeJson(TOKEN_PATH, storedToken);
    return storedToken.access_token;
  } finally {
    server.close();
  }
}

function decodeBase64Url(value) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
    "utf8",
  );
}

async function getLabelId(accessToken) {
  const data = await fetchJson(
    "https://gmail.googleapis.com/gmail/v1/users/me/labels",
    accessToken,
  );
  const label = data.labels?.find((item) => item.name === LABEL_NAME);

  if (!label) {
    throw new Error(`Could not find Gmail label "${LABEL_NAME}".`);
  }

  return label.id;
}

async function listMessageIds(accessToken, labelId) {
  const messageIds = [];
  let pageToken = null;

  do {
    const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
    url.searchParams.set("labelIds", labelId);
    url.searchParams.set("maxResults", "50");
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const data = await fetchJson(url, accessToken);
    messageIds.push(...(data.messages ?? []).map((message) => message.id));
    pageToken = data.nextPageToken ?? null;
  } while (pageToken);

  return messageIds;
}

async function getRawMessage(accessToken, messageId) {
  const url = new URL(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
  );
  url.searchParams.set("format", "raw");
  const data = await fetchJson(url, accessToken);
  return decodeBase64Url(data.raw);
}

async function main() {
  const credentials = readCredentials();
  const accessToken = await authorize(credentials);
  const labelId = await getLabelId(accessToken);
  const messageIds = await listMessageIds(accessToken, labelId);
  const store = readStore();
  const seen = new Set(store.emailImports.map((item) => item.gmailMessageId));
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const messageId of messageIds) {
    if (seen.has(messageId)) {
      skipped += 1;
      continue;
    }

    const raw = await getRawMessage(accessToken, messageId);
    const result = importRawEmail(store, raw, messageId);
    imported += result.imported;
    updated += result.updated;
    if (result.skipped) {
      skipped += 1;
    }
  }

  writeStore(store);
  console.log(
    `Gmail sync complete: ${imported} listings imported, ${updated} updated, ${skipped} emails skipped.`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
