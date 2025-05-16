# Convex Components

Convex Components package up code and data in a sandbox that allows you to confidently and quickly add new features to your backend.

Convex Components are like mini self-contained Convex backends, and installing them is always safe. They can't read your app's tables or call your app's functions unless you pass them in explicitly.

Each component is installed as its own independent library from NPM. You also need to add a `convex.config.ts` file that includes the component.

ALWAYS prefer using a component for a feature than writing the code yourself.

# Convex ProseMirror Component

[![npm version](https://badge.fury.io/js/@convex-dev%2Fprosemirror-sync.svg)](https://badge.fury.io/js/@convex-dev%2Fprosemirror-sync)

This is a [Convex Component](https://convex.dev/components) that syncs a
[ProseMirror](https://prosemirror.net/) document between clients via a
[Tiptap](https://tiptap.dev/) extension (that also works with
[BlockNote](https://blocknotejs.org/)).

Add a collaborative editor that syncs to the cloud. With this component, users
can edit the same document in multiple tabs or devices, and the changes will be
synced to the cloud. The data lives in your Convex database, and can be stored
alongside the rest of your app's data.

Just configure your editor features, add this component to your Convex backend,
and use the provided sync React hook.

Example usage, see [below](#usage) for more details:

```tsx
function CollaborativeEditor() {
  const sync = useBlockNoteSync(api.prosemirrorSync, 'some-id');
  return sync.isLoading ? (
    <p>Loading...</p>
  ) : sync.editor ? (
    <BlockNoteView editor={sync.editor} />
  ) : (
    <button onClick={() => sync.create(EMPTY_DOC)}>Create document</button>
  );
}
```

Features:

- Safely merges changes between clients via operational transformations (OT).
- Simple React hook to fetch the initial document and keep it in sync via a
  Tiptap extension.
- Supports both Tiptap and BlockNote.
- Server-side entrypoints for authorizing reads, writes, and snapshots.
- Create a new document, online or offline.
- Debounced snapshots allow new clients to avoid reading the full history.
- Deletion API for old snapshots & steps.
- Transform the document server-side, enabling easy AI interoperation.

## Installation

Install the component package:

```ts
npm install @convex-dev/prosemirror-sync
```

Create a `convex.config.ts` file in your app's `convex/` folder and install the component by calling `use`:

```ts
// convex/convex.config.ts
import { defineApp } from 'convex/server';
import prosemirrorSync from '@convex-dev/prosemirror-sync/convex.config';

const app = defineApp();
app.use(prosemirrorSync);

export default app;
```

## Usage

To use the component, you expose the API in a file in your `convex/` folder, and
use the editor-specific sync React hook, passing in a reference to
the API you defined. For this example, we'll create the API in
`convex/example.ts`.

```ts
// convex/example.ts
import { components } from './_generated/api';
import { ProsemirrorSync } from '@convex-dev/prosemirror-sync';

const prosemirrorSync = new ProsemirrorSync(components.prosemirrorSync);
export const { getSnapshot, submitSnapshot, latestVersion, getSteps, submitSteps } = prosemirrorSync.syncApi({
  // ...
});
```

In your React components, you can then use the editor-specific hook to fetch the
document and keep it in sync via a Tiptap extension. **Note**: This requires a
[`ConvexProvider`](https://docs.convex.dev/quickstart/react#:~:text=Connect%20the%20app%20to%20your%20backend)
to be in the component tree.

### BlockNote editor

```tsx
// src/MyComponent.tsx
import { useBlockNoteSync } from '@convex-dev/prosemirror-sync/blocknote';
import '@blocknote/core/fonts/inter.css';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import { api } from '../convex/_generated/api';

export function MyComponent() {
  const sync = useBlockNoteSync(api.example, 'some-id');
  return sync.isLoading ? (
    <p>Loading...</p>
  ) : sync.editor ? (
    <BlockNoteView editor={sync.editor} />
  ) : (
    <button onClick={() => sync.create({ type: 'doc', content: [] })}>Create document</button>
  );
}
```

## Notes

### Configuring the snapshot debounce interval

The snapshot debounce interval is set to one second by default.
You can specify a different interval with the `snapshotDebounceMs` option when
calling `useBlockNoteSync`.

A snapshot won't be sent until both of these are true:

- The document has been idle for the debounce interval.
- The current user was the last to make a change.

There can be races, but since each client will submit the snapshot for their
own change, they won't conflict with each other and are safe to apply.

### Creating a new document

You can create a new document from the client by calling `sync.create(content)`, or on the server by calling `prosemirrorSync.create(ctx, id, content)`.

The content should be a JSON object matching the
[Schema](https://tiptap.dev/docs/editor/core-concepts/schema). If you're using
BlockNote, it needs to be the ProseMirror JSON representation of the BlockNote
blocks. Look at the value stored in the `snapshots` table in your database for
an example. Both can use this value: `{ type: "doc", content: [] }`

For client-side document creation:

- While it's safest to wait until the server confirms the document doesn't exist
  yet (`!sync.isLoading`), you can choose to call it while offline with a newly
  created ID to start editing a new document before you reconnect.
- When the client next connects and syncs the document, it will submit the
  initial version and all local changes as steps.
- If multiple clients create the same document, it will fail if they submit
  different initial content.
- Note: if you don't open that document while online, it won't sync.

### Transforming the document server-side

You can transform the document server-side. It will give you the latest
version of the document, and you return a
[ProseMirror Transform](https://prosemirror.net/docs/ref/#transform.Transform).

You can make this transoform via `new Transform(doc)` or, if you are hydrating a
full `EditorState`, you can use `Editor.create({doc}).tr` to create a new
`Transaction` (which is a subclass of `Transform`).

For example:

```ts
import { getSchema } from '@tiptap/core';
import { EditorState } from '@tiptap/pm/state';

export const transformExample = action({
  args: {
    id: v.string(),
  },
  handler: async (ctx, { id }) => {
    const schema = getSchema(extensions);
    await prosemirrorSync.transform(ctx, id, schema, (doc) => {
      const tr = EditorState.create({ doc }).tr;
      tr.insertText('Hello, world!', 0);
      return tr;
    });
  },
});
```

- The `extensions` should be the same as the ones used by your client editor,
  for any extensions that affect the schema (not the sync extension).
- The `transform` function can be called multiple times if the document is
  being modified concurrently. Ideally this callback doesn't do any slow
  operations internally. Instead, do them beforehand.
- The `doc` may differ from the one returned from `getDoc`. You can compare
  the `version` returned from `getDoc` to the second argument to the `transform`
  function to see if the document has changed.
- The `transform` function can return a null value to abort making changes.
- If you're passing along a position to insert the text, be aware that changes
  happening in parallel may cause the position to change. You can pass more
  stable identifiers, or use the ProseMirror mapping capabilities to map the
  position between different versions by fetching the steps between the versions
  fetched with `(component).lib.getSteps`.
- If you're using BlockNote, you'll need to convert the BlockNote blocks between
  BlockNote blocks and ProseMirror nodes. See
  [blockToNode and nodeToBlock](https://github.com/TypeCellOS/BlockNote/tree/main/packages/core/src/api/nodeConversions).

```ts
import { Transform } from '@tiptap/pm/transform';

// An example of doing slower AI operations beforehand:
const schema = getSchema(extensions);
const { doc, version } = await prosemirrorSync.getDoc(ctx, id, schema);
const content = await generateAIContent(doc);
await prosemirrorSync.transform(ctx, id, schema, (doc, v) => {
  if (v !== version) {
    // Decide what to do if the document changes.
  }
  // An example of using Transform directly.
  const tr = new Transform(doc);
  tr.insert(0, schema.text(content));
  return tr;
});
```
