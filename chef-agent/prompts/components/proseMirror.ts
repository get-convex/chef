export const proseMirrorComponentReadmePrompt = `


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

\`\`\`tsx
function CollaborativeEditor() {
  const sync = useBlockNoteSync<BlockNoteEditor>(api.prosemirrorSync, "some-id");
  return sync.isLoading ? (
    <p>Loading...</p>
  ) : sync.editor ? (
    <BlockNoteView editor={sync.editor} />
  ) : (
    <button onClick={() => sync.create(EMPTY_DOC)}>Create document</button>
  );
}
\`\`\`

## Installation

Install the component package:

\`\`\`ts
npm install @convex-dev/prosemirror-sync
\`\`\`

Create a \`convex.config.ts\` file in your app's \`convex/\` folder and install the component by calling \`use\`:

\`\`\`ts
// convex/convex.config.ts
import { defineApp } from 'convex/server';
import prosemirrorSync from '@convex-dev/prosemirror-sync/convex.config';

const app = defineApp();
app.use(prosemirrorSync);

export default app;
\`\`\`

You do NOT need to add component tables to your \`schema.ts\`. The component tables are only read and written to from the component functions.

Component functions are only accessible by \`components.<component_name>.<component_function_path>\` imported from \`./_generated/api\` like
\`import { components } from "./_generated/api";\` after code is initially pushed.

## Usage

To use the component, you expose the API in a file in your \`convex/\` folder, and
use the editor-specific sync React hook, passing in a reference to
the API you defined. For this example, we'll create the API in
\`convex/example.ts\`.

\`\`\`ts
// convex/example.ts
import { components } from './_generated/api';
import { ProsemirrorSync } from '@convex-dev/prosemirror-sync';

const prosemirrorSync = new ProsemirrorSync(components.prosemirrorSync);
export const { getSnapshot, submitSnapshot, latestVersion, getSteps, submitSteps } = prosemirrorSync.syncApi({
  // ...
});
\`\`\`

DO NOT use any other component functions outside the functions exposed by \`prosemirrorSync.syncApi\`.

/\*\*

- Expose the sync API to the client for use with the \`useBlockNoteSync\` hook.
- If you export these in \`convex/prosemirror.ts\`, pass \`api.prosemirror\`
- to the \`useBlockNoteSync\` hook.
-
- It allows you to define optional read and write permissions, along with
- a callback when new snapshots are available.
-
- You can pass the optional type argument \`<DataModel>\` to have the \`ctx\`
- parameter specific to your tables.
-
- \`\`\`ts

  \`\`\`

- import { DataModel } from "./convex/\_generated/dataModel";
- import { GenericQueryCtx } from 'convex/server';
- // ...
- export const { ... } = prosemirrorSync.syncApi<DataModel>({...});
- \`\`\`

  \`\`\`

-
- To define just one function to use for both, you can define it like this:
- \`\`\`ts

  \`\`\`

- async function checkPermissions(ctx: GenericQueryCtx<DataModel>, id: string) {
- const user = await getAuthUser(ctx);
- if (!user || !(await canUserAccessDocument(user, id))) {
-     throw new Error("Unauthorized");
- }
- }
- \`\`\`

  \`\`\`

  Id in the following type definition extends the string type. Pass ids as strings into the functions.

  export class ProsemirrorSync<Id extends string = string> {

- @param opts - Optional callbacks.
- @returns functions to export, so the \`useBlockNoteSync\` hook can use them.
  \*/
  syncApi<DataModel extends GenericDataModel>(opts?: {
  /\*\*
  - Optional callback to check read permissions.
  - Throw an error if the user is not authorized to read the document.
  - @param ctx - A Convex query context.
  - @param id - The document ID.
    \*/
    checkRead?: (
    ctx: GenericQueryCtx<DataModel>,
    id: Id
    ) => void | Promise<void>;
    /\*\*
  - Optional callback to check write permissions.
  - Throw an error if the user is not authorized to write to the document.
  - @param ctx - A Convex mutation context.
  - @param id - The document ID.
    \*/
    checkWrite?: (
    ctx: GenericMutationCtx<DataModel>,
    id: Id
    ) => void | Promise<void>;
    /\*\*
  - Optional callback to run when a new snapshot is available.
  - Version 1 is the initial content.
  - @param ctx - A Convex mutation context.
  - @param id - The document ID.
  - @param snapshot - The snapshot content, as stringified ProseMirror JSON.
  - @param version - The version this snapshot represents.
    \*/
    onSnapshot?: (
    ctx: GenericMutationCtx<DataModel>,
    id: Id,
    snapshot: string,
    version: number
    ) => void | Promise<void>;
    ...
    }

In your React components, you can then use the editor-specific hook to fetch the
document and keep it in sync via a Tiptap extension. **Note**: This requires a
[\`ConvexProvider\`](https://docs.convex.dev/quickstart/react#:~:text=Connect%20the%20app%20to%20your%20backend)
to be in the component tree.

### BlockNote editor

\`\`\`tsx
// src/MyComponent.tsx
import { useBlockNoteSync } from '@convex-dev/prosemirror-sync/blocknote';
import '@blocknote/core/fonts/inter.css';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import { api } from '../convex/_generated/api';
import { BlockNoteEditor } from '@blocknote/core';

function MyComponent({ id }: { id: string }) {
  const sync = useBlockNoteSync<BlockNoteEditor>(api.example, id);
  return sync.isLoading ? (
    <p>Loading...</p>
  ) : sync.editor ? (
    <BlockNoteView editor={sync.editor} />
  ) : (
    <button onClick={() => sync.create({ type: 'doc', content: [] })}>Create document</button>
  );
}

export function MyComponentWrapper({ id }: { id: string }) {
  return <MyComponent key={id} id={id} />;
}
\`\`\`

The \`MyComponentWrapper\` component is a wrapper that ensures the editor is re-rendered when the \`id\` prop changes. 
This is a workaround for a bug where \`useBlockNoteSync\` doesn't reinitialize the editor when the \`id\` prop changes.

sync.create accepts an argument with \`JSONContent\` type. DO NOT pass it a string, it must be an object that matches \`JSONContent\` type:

\`\`\`
export type JSONContent = {
  type?: string;
  attrs?: Record<string, any>;
  content?: JSONContent[];
  marks?: {
    type: string;
    attrs?: Record<string, any>;
    [key: string]: any;
  }[];
  text?: string;
  [key: string]: any;
};
\`\`\`

Here is the source code for the \`useBlockNoteSync\` hook.

\`\`\`ts
import { useMemo } from "react";
import type { SyncApi } from "../client";
import { type UseSyncOptions, useTiptapSync } from "../tiptap";
import {
  type Block,
  BlockNoteEditor,
  type BlockNoteEditorOptions,
  nodeToBlock,
} from "@blocknote/core";
import { JSONContent } from "@tiptap/core";

export type BlockNoteSyncOptions<Editor = BlockNoteEditor> = UseSyncOptions & {
  /**
   * If you pass options into the editor, you should pass them here, to ensure
   * the initialContent is parsed with the correct schema.
   */
  editorOptions?: Partial<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Omit<BlockNoteEditorOptions<any, any, any>, "initialContent">
  >;
  /**
   * @deprecated Do \`useBlockNoteSync<BlockNoteEditor>\` instead.
   *
   */
  BlockNoteEditor?: Editor;
};

/**
 * A hook to sync a BlockNote editor with a Convex document.
 *
 * Usually used like:
 *
 * \`\`\`tsx
 * const sync = useBlockNoteSync(api.example, "some-id");
 * \`\`\`
 *
 * If you see an error like:
 * \`\`\`
 * Property 'options' is protected but type 'BlockNoteEditor<BSchema, ISchema, SSchema>' is not a class derived from 'BlockNoteEditor<BSchema, ISchema, SSchema>'.
 * \`\`\`
 * You can pass your own BlockNoteEditor like:
 * \`\`\`tsx
 * import { BlockNoteEditor } from "@blocknote/core";
 * //...
 * const sync = useBlockNoteSync<BlockNoteEditor>(api.example, "some-id");
 * \`\`\`
 * This is a workaround for the types of your editor not matching the editor
 * version used by prosemirror-sync.
 *
 * @param syncApi Wherever you exposed the sync api, e.g. \`api.example\`.
 * @param id The document ID.
 * @param opts Options to pass to the underlying BlockNoteEditor and sync opts.
 * @returns The editor, loading state, and fn to create the initial document.
 */
export function useBlockNoteSync<Editor = BlockNoteEditor>(
  syncApi: SyncApi,
  id: string,
  opts?: BlockNoteSyncOptions<Editor>
):
  | {
      editor: null;
      isLoading: true;
      create?: (content: JSONContent) => Promise<void>;
    }
  | {
      editor: null;
      isLoading: false;
      create: (content: JSONContent) => Promise<void>;
    }
  | {
      editor: Editor;
      isLoading: false;
    } {
  const sync = useTiptapSync(syncApi, id, opts);
  const editor = useMemo(() => {
    if (sync.initialContent === null) return null;
    const editor = BlockNoteEditor.create({
      ...opts?.editorOptions,
      _headless: true,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blocks: Block<any, any, any>[] = [];

    // Convert the prosemirror document to BlockNote blocks.
    // inspired by https://github.com/TypeCellOS/BlockNote/blob/main/packages/server-util/src/context/ServerBlockNoteEditor.ts#L42
    const pmNode = editor.pmSchema.nodeFromJSON(sync.initialContent);
    if (pmNode.firstChild) {
      pmNode.firstChild.descendants((node) => {
        blocks.push(nodeToBlock(node, editor.pmSchema));
        return false;
      });
    }
    return BlockNoteEditor.create({
      ...opts?.editorOptions,
      _tiptapOptions: {
        ...opts?.editorOptions?._tiptapOptions,
        extensions: [
          ...(opts?.editorOptions?._tiptapOptions?.extensions ?? []),
          sync.extension,
        ],
      },
      initialContent: blocks.length > 0 ? blocks : undefined,
    });
  }, [sync.initialContent]);

  if (sync.isLoading) {
    return {
      editor: null,
      isLoading: true,
      /**
       * Create the document without waiting to hear from the server.
       * Warning: Only call this if you just created the document id.
       * It's safer to wait until loading is false.
       * It's also best practice to pass in the same initial content everywhere,
       * so if two clients create the same document id, they'll both end up
       * with the same initial content. Otherwise the second client will
       * throw an exception on the snapshot creation.
       */
      create: sync.create,
    } as const;
  }
  if (!editor) {
    return {
      editor: null,
      isLoading: false,
      create: sync.create!,
    } as const;
  }
  return {
    editor: editor as unknown as Editor,
    isLoading: false,
  } as const;
}

\`\`\`

## Notes

### Configuring the snapshot debounce interval

The snapshot debounce interval is set to one second by default.
You can specify a different interval with the \`snapshotDebounceMs\` option when
calling \`useBlockNoteSync\`.

A snapshot won't be sent until both of these are true:

- The document has been idle for the debounce interval.
- The current user was the last to make a change.

There can be races, but since each client will submit the snapshot for their
own change, they won't conflict with each other and are safe to apply.

### Creating a new document

You can create a new document from the client by calling \`sync.create(content)\`, or on the server by calling \`prosemirrorSync.create(ctx, id, content)\`.

The content should be a JSON object matching the
[Schema](https://tiptap.dev/docs/editor/core-concepts/schema). If you're using
BlockNote, it needs to be the ProseMirror JSON representation of the BlockNote
blocks. Look at the value stored in the \`snapshots\` table in your database for
an example. Both can use this value: \`{ type: "doc", content: [] }\`

For client-side document creation:

- While it's safest to wait until the server confirms the document doesn't exist
  yet (\`!sync.isLoading\`), you can choose to call it while offline with a newly
  created ID to start editing a new document before you reconnect.
- When the client next connects and syncs the document, it will submit the
  initial version and all local changes as steps.
- If multiple clients create the same document, it will fail if they submit
  different initial content.
- Note: if you don't open that document while online, it won't sync.
`;
