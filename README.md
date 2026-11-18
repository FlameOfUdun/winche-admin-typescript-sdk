# Winche admin TypeScript SDK (`@winche-technologies/winche-admin`)

A Winche project's data — documents, files, the app's users, assets, and calling functions — with one API wherever it
runs.

```sh
npm install @winche-technologies/winche-admin       # Node, bundlers
```

```json
// deno.json (functions)
{ "imports": { "@winche-technologies/winche-admin": "npm:@winche-technologies/winche-admin@^3" } }
```

Where it runs:

| Where | Acts as | Limited by |
| --- | --- | --- |
| Functions (`import … from "@winche-technologies/winche-admin"`) | the server | nothing (access rules don't apply) |
| Console pages (bundled with the page) | the person who opened the page | their role in the project |
| Anywhere else (`initializeAdmin`) | a service account (its key, or a trusted identity) | its role in the project |

```ts
import { initializeAdmin, FieldValue } from "@winche-technologies/winche-admin";

// A service account's key (exchanged for access tokens, renewed by itself); or identityToken: () => <your host's
// OpenID Connect token>, for an account that trusts that identity (no key to keep).
const admin = initializeAdmin({ server: "https://winche.example.com", project: "clinic", key: process.env.WINCHE_KEY! });
await admin.documents.doc("wards/a").update({ visits: FieldValue.increment(1) });
const report = await admin.files.child("reports/a.pdf").getData();
```

Roles: a viewer reads; a member also writes documents, files and the app's users; an admin may also call functions.

`as(user)` gives the same API acting as one of the app's users: documents and files calls are checked against the
project's access rules for them, as if the app had made them; `functions.call` passes them as the caller.

```ts
import { callable } from "@winche-technologies/winche-functions";
import { as } from "@winche-technologies/winche-admin";

export const leave = callable(async (data: { ward: string }, ctx) => {
  await as(ctx.caller!).documents.doc(`wards/${data.ward}/members/${ctx.caller!.uid}`).delete();   // the rules decide
});
```

References (`doc`, `collection`, `child`, `user`) and the snapshots their reads return read like the Dart SDKs. See
Winche.Functions' README for the whole API.

## How it's used

- **Functions:** each project names this package in its `deno.json`; the server bundles the version it names.
- **Console pages:** bundled with the page (or its built file copied beside it).
- **Other servers:** this npm package, with `initializeAdmin`.

## Develop

`src/admin.ts` is the only source. `npm run build` (Deno and Node) makes `dist/`; `npm test` builds and runs the Node
test.

## License

MIT (`LICENSE`).
