// A smoke test of the built package from Node: initializeAdmin sends each call to the project's admin API with the
// token, and answers come back as the SDK's objects; errors keep their code.
import assert from "node:assert/strict";
import { initializeAdmin, FieldValue, WincheError } from "../dist/index.js";

const sent = [];
const fakeFetch = async (url, init) => {
  sent.push({ url, auth: init.headers.authorization, protocol: init.headers["x-winche-protocol"], body: JSON.parse(init.body) });
  const { op, args } = JSON.parse(init.body);
  if (op === "db.get") return Response.json({ result: { document: { path: args.path, id: "a", collection: "notes", fields: { text: { stringValue: "hi" } }, createTime: "2026-01-01T00:00:00.000000Z", updateTime: "2026-01-01T00:00:00.000000Z", version: 1 } } });
  if (op === "db.write") return Response.json({ result: { writeResults: [{}] } });
  return Response.json({ error: { code: "permission-denied", message: `${op} needs the admin role.` } }, { status: 403 });
};
const admin = initializeAdmin({ server: "https://winche.example.com/", project: "clinic", token: () => "wsa_test", fetch: fakeFetch });

const doc = await admin.documents.doc("notes/a").get();
assert.equal(doc.get("text"), "hi");
assert.deepEqual(sent[0], { url: "https://winche.example.com/console/v1/projects/clinic/admin", auth: "Bearer wsa_test", protocol: "1", body: { op: "db.get", args: { path: "notes/a" } } });

await admin.documents.doc("notes/a").update({ count: FieldValue.increment(1) });
assert.equal(sent[1].body.op, "db.write");

await admin.as({ uid: "ann" }).documents.doc("notes/a").get();
assert.deepEqual(sent[2].body.args.as, { uid: "ann", token: {} });

await assert.rejects(admin.functions.call("wipe"), (e) => e instanceof WincheError && e.code === "permission-denied" && /admin role/.test(e.message));
// A service account's key: exchanged once for an access token, used for the calls, and exchanged again when a call is
// refused (its key replaced meanwhile).
const calls = [];
let issued = 0, refuseNext = false;
const keyFetch = async (url, init) => {
  const body = JSON.parse(init.body);
  calls.push({ url: url.replace("https://winche.example.com/console/v1/projects/clinic/", ""), auth: init.headers.authorization ?? null, body });
  if (url.endsWith("/service-accounts/token"))
    return body.key === "wsk_good" ? Response.json({ accessToken: `wsa_${++issued}`, expiresAt: new Date(Date.now() + 3600_000).toISOString() })
      : Response.json({ error: { code: "INVALID_KEY", message: "That key isn't valid." } }, { status: 401 });
  if (refuseNext) { refuseNext = false; return Response.json({ error: { code: "unauthenticated", message: "expired" } }, { status: 401 }); }
  return Response.json({ result: { document: null } });
};
const service = initializeAdmin({ server: "https://winche.example.com", project: "clinic", key: "wsk_good", fetch: keyFetch });
await service.documents.doc("notes/a").get();
await service.documents.doc("notes/b").get();
assert.deepEqual(calls.map((c) => [c.url, c.auth]), [["service-accounts/token", null], ["admin", "Bearer wsa_1"], ["admin", "Bearer wsa_1"]]);
assert.deepEqual(calls[0].body, { key: "wsk_good" });
refuseNext = true;
await service.documents.doc("notes/c").get();
assert.deepEqual(calls.slice(3).map((c) => [c.url, c.auth]), [["admin", "Bearer wsa_1"], ["service-accounts/token", null], ["admin", "Bearer wsa_2"]]);

const identity = initializeAdmin({ server: "https://winche.example.com", project: "clinic", identityToken: async () => "eyJ.job.token", fetch: keyFetch });
await assert.rejects(identity.documents.doc("notes/a").get(), (e) => e.code === "INVALID_KEY");   // this fake trusts no identity
assert.deepEqual(calls.at(-1).body, { assertion: "eyJ.job.token" });
assert.throws(() => initializeAdmin({ server: "https://winche.example.com", project: "clinic", key: "k", token: "t" }), /one of key/);

// Realtime: the ops and payloads it sends (base64), and what it makes of the answers.
const rtSent = [];
const rt = initializeAdmin({ server: "https://winche.example.com", project: "clinic", token: () => "t", fetch: async (url, init) => {
  const { op, args } = JSON.parse(init.body); rtSent.push({ op, args });
  if (op === "realtime.append") return Response.json({ result: { positions: [1] } });
  if (op === "realtime.read") return Response.json({ result: { items: [{ key: "a:1", position: 1, at: "2026-01-01T00:00:00Z", by: "ann", payload: btoa('{"n":1}') }], list: { path: args.path, state: "open", count: 1, bytes: 7, openedAt: "2026-01-01T00:00:00Z", closedAt: null } } });
  return Response.json({ result: {} });
} });
assert.deepEqual(await rt.realtime.list("sessions/s1").append([{ key: "a:1", payload: { n: 1 } }]), [1]);
assert.equal(rtSent[0].op, "realtime.append");
assert.equal(atob(rtSent[0].args.items[0].payload), '{"n":1}');
const read = await rt.realtime.list("sessions/s1").read({ after: 0 });
assert.deepEqual(read.items[0].json(), { n: 1 });
assert.equal(read.list.count, 1);
await rt.realtime.channel("sessions/s1", "telemetry").publish(new Uint8Array([1, 2]));
assert.deepEqual(rtSent.at(-1), { op: "realtime.publish", args: { path: "sessions/s1", channel: "telemetry", payload: "AQI=" } });

console.log("ok: @winche-technologies/winche-admin from Node");
