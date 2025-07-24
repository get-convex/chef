import { stripIndents } from '../utils/stripIndent.js';
import type { SystemPromptOptions } from '../types.js';

export function convexGuidelines(options: SystemPromptOptions) {
  return stripIndents`# Convex guidelines

## Function guidelines

### New function syntax

- ALWAYS use the new function syntax for Convex functions. For example:

\`\`\`ts
import { query } from "./_generated/server";
import { v } from "convex/values";
export const f = query({
  args: {},
  handler: async (ctx, args) => {
    // Function body
  },
});
\`

### Http endpoint syntax

- HTTP endpoints are defined in \`convex/http.ts\` and require an \`httpAction\` decorator. For example:

\`\`\`ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
const http = httpRouter();
http.route({
    path: "/echo",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
      const body = await req.bytes();
      return new Response(body, { status: 200 });
    }),
});
\`\`\`

- HTTP endpoints are always registered at the exact path you specify in the \`path\` field. For example,
if you specify \`/api/someRoute\`, the endpoint will be registered at \`/api/someRoute\`.

### Validators

- Here are the valid Convex types along with their respective validators:
 Convex Type  | TS/JS type  |  Example Usage         | Validator for argument validation and schemas  | Notes
                                                                              |
| ----------- | ------------| -----------------------| -----------------------------------------------| ------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------|
| Id          | string      | \`doc._id\`              | \`v.id(tableName)\`                              |
                                                                              |
| Null        | null        | \`null\`                 | \`v.null()\`                                     | JavaScript's \`undefined\` is not a valid Convex value. Functions the return \`undefined\` or do not return will return \`null\` when called from a client. Use \`null\` instead.                             |
| Int64       | bigint      | \`3n\`                   | \`v.int64()\`                                    | Int64s only support BigInts between -2^63 and 2^63-1. Convex supports \`bigint\`s in most modern browsers.
                                                                              |
| Float64     | number      | \`3.1\`                  | \`v.number()\`                                   | Convex supports all IEEE-754 double-precision floating point numbers (such as NaNs). Inf and NaN are JSON serialized as
strings.                                                                      |
| Boolean     | boolean     | \`true\`                 | \`v.boolean()\`                                  |
| String      | string      | \`"abc"\`                | \`v.string()\`                                   | Strings are stored as UTF-8 and must be valid Unicode sequences. Strings must be smaller than the 1MB total size limit w
hen encoded as UTF-8.                                                         |
| Bytes       | ArrayBuffer | \`new ArrayBuffer(8)\`   | \`v.bytes()\`                                    | Convex supports first class bytestrings, passed in as \`ArrayBuffer\`s. Bytestrings must be smaller than the 1MB total siz
e limit for Convex types.                                                     |
| Array       | Array]      | \`[1, 3.2, "abc"]\`      | \`v.array(values)\`                              | Arrays can have at most 8192 values.
                                                                              |
| Object      | Object      | \`{a: "abc"}\`           | \`v.object({property: value})\`                  | Convex only supports "plain old JavaScript objects" (objects that do not have a custom prototype). Objects can have at most 1024 entries. Field names must be ASCII characters, nonempty, and not start with "$" or "_". |
| Record      | Record      | \`{"a": "1", "b": "2"}\` | \`v.record(keys, values)\`                       | Records are objects at runtime, but can have dynamic keys. Keys must be only ASCII characters, nonempty, and not start with "$" or "_".

- \`v.object()\`, \`v.array()\`, \`v.boolean()\`, \`v.number()\`, \`v.string()\`, \`v.id()\`, and \`v.null()\` are the most common
  validators you'll need. Do NOT use any other validators. In particular, \`v.map()\` and \`v.set()\` are not supported.

- Below is an example of an array validator:

\`\`\`ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export default mutation({
  args: {
      simpleArray: v.array(v.union(v.string(), v.number())),
  },
  handler: async (ctx, args) => {
      //...
  },
});
\`\`\`

- Below is an example of a schema with validators that codify a discriminated union type:
\`\`\`ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    results: defineTable(
        v.union(
            v.object({
                kind: v.literal("error"),
                errorMessage: v.string(),
            }),
            v.object({
                kind: v.literal("success"),
                value: v.number(),
            }),
        ),
    )
});
\`\`\`

- ALWAYS use argument validators. For example:

\`\`\`ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export default mutation({
  args: {
    simpleArray: v.array(v.union(v.string(), v.number())),
  },
  handler: async (ctx, args) => {
    //...
  },
});
\`\`\`

- NEVER use return validators when getting started writing an app. For example:

\`\`\`ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export default mutation({
  args: {
    simpleArray: v.array(v.union(v.string(), v.number())),
  },
  // Do NOT include a return validator with the \`returns\` field.
  // returns: v.number(),
  handler: async (ctx, args) => {
    //...
    return 100;
  },
});
\`\`\`

### Function registration

- Use \`internalQuery\`, \`internalMutation\`, and \`internalAction\` to register internal functions. These functions are private and aren't part of an app's API. They can only be called by other Convex functions. These functions are always imported from \`./_generated/server\`.
- Use \`query\`, \`mutation\`, and \`action\` to register public functions. These functions are part of the public API and are exposed to the public Internet. Do NOT use \`query\`, \`mutation\`, or \`action\` to register sensitive internal functions that should be kept private.
- You CANNOT register a function through the \`api\` or \`internal\` objects.
- ALWAYS include argument validators for all Convex functions. This includes all of \`query\`, \`internalQuery\`, \`mutation\`, \`internalMutation\`, \`action\`, and \`internalAction\`.
- If the JavaScript implementation of a Convex function doesn't have a return value, it implicitly returns \`null\`.

### Function calling

- Use \`ctx.runQuery\` to call a query from a query, mutation, or action.
- Use \`ctx.runMutation\` to call a mutation from a mutation or action.
- Use \`ctx.runAction\` to call an action from an action.
- ONLY call an action from another action if you need to cross runtimes (e.g. from V8 to Node). Otherwise, pull out the shared code into a helper async function and call that directly instead.
- Try to use as few calls from actions to queries and mutations as possible. Queries and mutations are transactions, so splitting logic up into multiple calls introduces the risk of race conditions.
- All of these calls take in a \`FunctionReference\`. Do NOT try to pass the callee function directly into one of these calls.
- When using \`ctx.runQuery\`, \`ctx.runMutation\`, or \`ctx.runAction\` to call a function in the same file, specify a type annotation on the return value to work around TypeScript circularity limitations. For example,

\`\`\`ts
export const f = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return "Hello " + args.name;
  },
});

export const g = query({
  args: {},
  handler: async (ctx, args) => {
    const result: string = await ctx.runQuery(api.example.f, { name: "Bob" });
    return null;
  },
});
\`\`\`

### Function references

- Function references are pointers to registered Convex functions.
- ALWAYS use the \`api\` object defined by the framework in \`convex/_generated/api.ts\` to call public functions registered with \`query\`, \`mutation\`, or \`action\`. You must import the \`api\` object in the same file when using it and it looks like:

\`\`\`ts
import { api } from "./_generated/api";
\`\`\`

- ALWAYS use the \`internal\` object defined by the framework in \`convex/_generated/api.ts\` to call internal (or private) functions registered with \`internalQuery\`, \`internalMutation\`, or \`internalAction\`. You must import the \`internal\` object in the same file when using it and it looks like:

\`\`\`ts
import { internal } from "./_generated/api";
\`\`\`

- Convex uses file-based routing, so a public function defined in \`convex/example.ts\` named \`f\` has a function reference of \`api.example.f\`.
- A private function defined in \`convex/example.ts\` named \`g\` has a function reference of \`internal.example.g\`.
- Functions can also registered within directories nested within the \`convex/\` folder. For example, a public function \`h\` defined in \`convex/messages/access.ts\` has a function reference of \`api.messages.access.h\`.

### Api design

- Convex uses file-based routing, so thoughtfully organize files with public query, mutation, or action functions within the \`convex/\` directory.
- Use \`query\`, \`mutation\`, and \`action\` to define public functions.
- Use \`internalQuery\`, \`internalMutation\`, and \`internalAction\` to define private, internal functions.

### Limits

To keep performance fast, Convex puts limits on function calls and database records:

- Queries, mutations, and actions can take in at most 8 MiB of data as arguments.
- Queries, mutations, and actions can return at most 8 MiB of data as their return value.

- Arrays in arguments, database records, and return values can have at most 8192 elements.
- Objects in function arguments and return values must be valid Convex objects, so they can
  only contain ASCII field names. ALWAYS remap non-ASCII characters like emoji to an
  ASCII code before storing them in an object synced to Convex.
- Objects and arrays can only be nested up to depth 16.
- Database records must be smaller than 1MiB.

- Queries and mutations can read up to 8MiB of data from the database.
- Queries and mutations can read up to 16384 documents from the database.
- Mutations can write up to 8MiB of data to the database.
- Mutations can write up to 8192 documents to the database.

- Queries and mutations can execute for at most 1 second.
- Actions and HTTP actions can execute for at most 10 minutes.

- HTTP actions have no limit on request body size but can stream out at most 20MiB of data.

IMPORTANT: Hitting any of these limits will cause a function call to fail with an error. You
MUST design your application to avoid hitting these limits. For example, if you are building
a stock ticker app, you can't store a database record for each stock ticker's price at a
point in time. Instead, download the data as JSON, save it to file storage, and have the app
download the JSON file into the browser and render it client-side.

### Environment variables

Convex supports environment variables within function calls via \`process.env\`. Environment
variables are useful for storing secrets like API keys and other per-deployment configuration.

You can read environment variables from all functions, including queries, mutations, actions,
and HTTP actions. For example:

\`\`\`ts
import { action } from "./_generated/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const helloWorld = action({
  args: {},
  handler: async (ctx, args) => {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Hello, world!" }],
    });
    return completion.choices[0].message.content;
  },
});
\`\`\`

### Pagination

- Paginated queries are queries that return a list of results in incremental pages.
- You can define pagination using the following syntax:

\`\`\`ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";

export const listWithExtraArg = query({
  args: { paginationOpts: paginationOptsValidator, author: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_author", (q) => q.eq("author", args.author))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
\`\`\`

Note: \`paginationOpts\` is an object with the following properties:
- \`numItems\`: the maximum number of documents to return (the validator is \`v.number()\`)
- \`cursor\`: the cursor to use to fetch the next page of documents (the validator is \`v.union(v.string(), v.null())\`)

- A query that ends in \`.paginate()\` returns an object that has the following properties: - page (contains an array of documents that you fetches) - isDone (a boolean that represents whether or not this is the last page of documents) - continueCursor (a string that represents the cursor to use to fetch the next page of documents)

## Schema guidelines

- Always define your schema in \`convex/schema.ts\`.
- Always import the schema definition functions from \`convex/server\`:
- System fields are automatically added to all documents and are prefixed with an underscore. The
  two system fields that are automatically added to all documents are \`_creationTime\` which has
  the validator \`v.number()\` and \`_id\` which has the validator \`v.id(tableName)\`.

### Index definitions

- Index names must be unique within a table.
- The system provides two built-in indexes: "by_id" and "by_creation_time." Never add these to the
  schema definition of a table! They're automatic and adding them to will be an error. You cannot
  use either of these names for your own indexes. \`.index("by_creation_time", ["_creationTime"])\`
  is ALWAYS wrong.
- Convex automatically includes \`_creationTime\` as the final column in all indexes.
- Do NOT under any circumstances include \`_creationTime\` as the last column in any index you define. This will result in an error.
  \`.index("by_author_and_creation_time", ["author", "_creationTime"])\` is ALWAYS wrong.
- Always include all index fields in the index name. For example, if an index is defined as
  \`["field1", "field2"]\`, the index name should be "by_field1_and_field2".
- Index fields must be queried in the same order they are defined. If you want to be able to
  query by "field1" then "field2" and by "field2" then "field1", you must create separate indexes.
- Index definitions MUST be nonempty. \`.index("by_creation_time", [])\` is ALWAYS wrong.

Here's an example of correctly using the built-in \`by_creation_time\` index:
Path: \`convex/schema.ts\`
\`\`\`ts
import { defineSchema } from "convex/server";

export default defineSchema({
  // IMPORTANT: No explicit \`.index("by_creation_time", ["_creationTime"]) \` is needed.
  messages: defineTable({
    name: v.string(),
    body: v.string(),
  })
    // IMPORTANT: This index sorts by \`(name, _creationTime)\`.
    .index("by_name", ["name"]),
});
\`\`\`
Path: \`convex/messages.ts\`
\`\`\`ts
import { query } from "./_generated/server";

export const exampleQuery = query({
  args: {},
  handler: async (ctx) => {
    // This is automatically in ascending \`_creationTime\` order.
    const recentMessages = await ctx.db.query("messages")
      .withIndex("by_creation_time", (q) => q.gt("_creationTime", Date.now() - 60 * 60 * 1000))
      .collect();

    // This is automatically in \`_creationTime\` order.
    const allMessages = await ctx.db.query("messages").order("desc").collect();

    // This query uses the index to filter by the name field and then implicitly
    // orders by \`_creationTime\`.
    const byName = await ctx.db.query("messages")
      .withIndex("by_name", (q) => q.eq("name", "Alice"))
      .order("asc")
      .collect();
  },
});
\`\`\`

## Typescript guidelines

- You can use the helper typescript type \`Id\` imported from './_generated/dataModel' to get the type of the id for a given table. For example if there is a table called 'users' you can use \`Id<'users'>\` to get the type of the id for that table.
- If you need to define a \`Record\` make sure that you correctly provide the type of the key and value in the type. For example a validator \`v.record(v.id('users'), v.string())\` would have the type \`Record<Id<'users'>, string>\`. Below is an example of using \`Record\` with an \`Id\` type in a query:

\`\`\`ts
import { query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

export const exampleQuery = query({
  args: { userIds: v.array(v.id("users")) },
  handler: async (ctx, args) => {
    const idToUsername: Record<Id<"users">, string> = {};
      for (const userId of args.userIds) {
        const user = await ctx.db.get(userId);
          if (user) {
            users[user._id] = user.username;
          }
        }

      return idToUsername;
  },
});
\`\`\`

- Be strict with types, particularly around id's of documents. For example, if a function takes in an id for a document in the 'users' table, take in \`Id<'users'>\` rather than \`string\`.
- Always use \`as const\` for string literals in discriminated union types.
- When using the \`Array\` type, make sure to always define your arrays as \`const array: Array<T> = [...];\`
- When using the \`Record\` type, make sure to always define your records as \`const record: Record<KeyType, ValueType> = {...};\`
- Always add \`@types/node\` to your \`package.json\` when using any Node.js built-in modules.

## Full text search guidelines

### Defining a search index
To use full text search, you need to define a search index in the schema. 
Every search index definition consists of:

1. A name.
   - Must be unique per table.
2. A \`searchField\`
   - This is the field which will be indexed for full text search.
   - It must be of type \`string\`.
3. [Optional] A list of \`filterField\`s
   - These are additional fields that are indexed for fast equality filtering
     within your search index.

Here's an example of how to define a search index:
\`\`\`ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  messages: defineTable({
    body: v.string(),
    channel: v.string(),
  }).searchIndex("search_body", {
    searchField: "body",
    filterFields: ["channel"],
  }),
});
\`\`\`
You can specify search and filter fields on nested documents by using a dot-separated path like properties.name.

### Querying with full text search

- A query for "10 messages in channel '#general' that best match the query 'hello hi' in their body" would look like:

\`\`\`ts
const messages = await ctx.db
  .query("messages")
  .withSearchIndex("search_body", (q) =>
    q.search("body", "hello hi").eq("channel", "#general"),
  )
  .take(10);
\`\`\`

## Query guidelines

- Do NOT use \`filter\` in queries. Instead, define an index in the schema and use \`withIndex\` instead.
- Convex queries do NOT support \`.delete()\`. Instead, \`.collect()\` the results, iterate over them, and call \`ctx.db.delete(row._id)\` on each result.
- Use \`.unique()\` to get a single document from a query. This method will throw an error if there are multiple documents that match the query.
- When using async iteration, don't use \`.collect()\` or \`.take(n)\` on the result of a query. Instead, use the \`for await (const row of query)\` syntax.

### Ordering

- By default Convex always returns documents in ascending \`_creationTime\` order.
- You can use \`.order('asc')\` or \`.order('desc')\` to pick whether a query is in ascending or descending order. If the order isn't specified, it defaults to ascending.
- Document queries that use indexes will be ordered based on the columns in the index and can avoid slow table scans.

## Mutation guidelines

- Use \`ctx.db.replace\` to fully replace an existing document. This method will throw an error if the document does not exist.
- Use \`ctx.db.patch\` to shallow merge updates into an existing document. This method will throw an error if the document does not exist.

## Action guidelines

- Always add \`"use node";\` to the top of files containing actions that use Node.js built-in modules.
- Files that contain \`"use node";\` should NEVER contain mutations or queries, only actions. Node actions can only be called from the client or from other actions.
- Never use \`ctx.db\` inside of an action. Actions don't have access to the database.
- Below is an example of the syntax for an action:

\`\`\`ts
import { action } from "./_generated/server";

export const exampleAction = action({
  args: {},
  handler: async (ctx, args) => {
    console.log("This action does not return anything");
    return null;
  },
});
\`\`\`

## Scheduling guidelines

### Cron guidelines

- Only use the \`crons.interval\` or \`crons.cron\` methods to schedule cron jobs. Do NOT use the \`crons.hourly\`, \`crons.daily\`, or \`crons.weekly\` helpers.
- Both cron methods take in a FunctionReference. Do NOT try to pass the function directly into one of these methods.
- Define crons by declaring the top-level \`crons\` object, calling some methods on it, and then exporting it as default. For example,

\`\`\`ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

const empty = internalAction({
  args: {},
  handler: async (ctx, args) => {
    console.log("empty");
  },
});

const crons = cronJobs();

// Run \`internal.crons.empty\` every two hours.
crons.interval("delete inactive users", { hours: 2 }, internal.crons.empty, {});

export default crons;
\`\`\`

- You can register Convex functions within \`crons.ts\` just like any other file.
- If a cron calls an internal function, always import the \`internal\` object from \`_generated/api\`, even if the internal function is registered in the same file.

### Scheduler guidelines

You can schedule a mutation or action to run in the future by calling
\`ctx.scheduler.runAfter(delay, functionReference, args)\` from a
mutation or action. Enqueuing a job to the scheduler is transactional
from within a mutation.

You MUST use a function reference for the first argument to \`runAfter\`,
not a string or the function itself.

Auth state does not propagate to scheduled jobs, so \`getAuthUserId()\` and
\`ctx.getUserIdentity()\` will ALWAYS return \`null\` from within a scheduled
job. Prefer using internal, privileged functions for scheduled jobs that don't
need to do access checks.

Scheduled jobs should be used sparingly and never called in a tight loop. Scheduled functions should not be scheduled more
than once every 10 seconds. Especially in things like a game simulation or something similar that needs many updates
in a short period of time.

## File storage guidelines

- Convex includes file storage for large files like images, videos, and PDFs.
- The \`ctx.storage.getUrl()\` method returns a signed URL for a given file. It returns \`null\` if the file doesn't exist.
- Do NOT use the deprecated \`ctx.storage.getMetadata\` call for loading a file's metadata.
- Do NOT store file urls in the database. Instead, store the file id in the database and query the \`_storage\` system table to get the url.
- Images are stored as Convex storage IDs. Do NOT directly as image URLs. Instead, fetch the signed URL for each image from Convex
  storage and use that as the image source.
- Make sure to ALWAYS use the \`_storage\` system table to get the signed URL for a given file.

Instead, query the \`_storage\` system table. For example, you can use \`ctx.db.system.get\` to get an \`Id<"_storage">\`.

\`\`\`ts
import { query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

type FileMetadata = {
  _id: Id<"_storage">;
  _creationTime: number;
  contentType?: string;
  sha256: string;
  size: number;
}

export const exampleQuery = query({
  args: { fileId: v.id("_storage") },
  handler: async (ctx, args) => {
    const metadata: FileMetadata | null = await ctx.db.system.get(args.fileId);
    console.log(metadata);
    return null;
  },
});
\`\`\`

- Convex storage stores items as \`Blob\` objects. You must convert all items to/from a \`Blob\` when using Convex storage.

# Examples
## Example of using Convex storage within a chat app

This example creates a mutation to generate a short-lived upload URL and a mutation to save an image message to the database. This mutation is called from the client, which uses the generated upload URL to upload an image to Convex storage. Then,
it gets the storage id from the response of the upload and saves it to the database with the \`sendImage\` mutation. On the frontend, it uses the \`list\` query to get the messages from the database and display them in the UI. In this query, the
backend grabs the url from the storage system table and returns it to the client which shows the images in the UI. You should use this pattern for any file upload. To keep track of files, you should save the storage id in the database.

Path: \`convex/messages.ts\`
\`\`\`ts
import { v } from "convex/values";
import { query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const messages = await ctx.db.query("messages").collect();
    return Promise.all(
      messages.map(async (message) => ({
        ...message,
        // If the message is an "image" its "body" is an \`Id<"_storage">\`
        ...(message.format === "image"
          ? { url: await ctx.storage.getUrl(message.body) }
          : {}),
      })),
    );
  },
});

import { mutation } from "./_generated/server";

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const sendImage = mutation({
  args: { storageId: v.id("_storage"), author: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("messages", {
      body: args.storageId,
      author: args.author,
      format: "image",
    });
  },
});

export const sendMessage = mutation({
  args: { body: v.string(), author: v.string() },
  handler: async (ctx, args) => {
    const { body, author } = args;
    await ctx.db.insert("messages", { body, author, format: "text" });
  },
});
\`\`\`

Path: \`src/App.tsx\`
\`\`\`ts
import { FormEvent, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

export default function App() {
  const messages = useQuery(api.messages.list) || [];

  const [newMessageText, setNewMessageText] = useState("");
  const sendMessage = useMutation(api.messages.sendMessage);

  const [name] = useState(() => "User " + Math.floor(Math.random() * 10000));
  async function handleSendMessage(event: FormEvent) {
    event.preventDefault();
    if (newMessageText) {
      await sendMessage({ body: newMessageText, author: name });
    }
    setNewMessageText("");
  }

  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const sendImage = useMutation(api.messages.sendImage);

  const imageInput = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  async function handleSendImage(event: FormEvent) {
    event.preventDefault();

    // Step 1: Get a short-lived upload URL
    const postUrl = await generateUploadUrl();
    // Step 2: POST the file to the URL
    const result = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": selectedImage!.type },
      body: selectedImage,
    });
    const json = await result.json();
    if (!result.ok) {
      throw new Error(\`Upload failed: \${JSON.stringify(json)}\`);
    }
    const { storageId } = json;
    // Step 3: Save the newly allocated storage id to the database
    await sendImage({ storageId, author: name });

    setSelectedImage(null);
    imageInput.current!.value = "";
  }

  return (
    <main>
      <h1>Convex Chat</h1>
      <p className="badge">
        <span>{name}</span>
      </p>
      <ul>
        {messages.map((message) => (
          <li key={message._id}>
            <span>{message.author}:</span>
            {message.format === "image" ? (
              <Image message={message} />
            ) : (
              <span>{message.body}</span>
            )}
            <span>{new Date(message._creationTime).toLocaleTimeString()}</span>
          </li>
        ))}
      </ul>
      <form onSubmit={handleSendMessage}>
        <input
          value={newMessageText}
          onChange={(event) => setNewMessageText(event.target.value)}
          placeholder="Write a message…"
        />
        <input type="submit" value="Send" disabled={!newMessageText} />
      </form>
      <form onSubmit={handleSendImage}>
        <input
          type="file"
          accept="image/*"
          ref={imageInput}
          onChange={(event) => setSelectedImage(event.target.files![0])}
          className="ms-2 btn btn-primary"
          disabled={selectedImage !== null}
        />
        <input
          type="submit"
          value="Send Image"
          disabled={selectedImage === null}
        />
      </form>
    </main>
  );
}

function Image({ message }: { message: { url: string } }) {
  return <img src={message.url} height="300px" width="auto" />;
}
\`\`\`

## Example of a real-time chat application with AI responses

Path: \`convex/functions.ts\`
\`\`\`ts
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  internalAction,
} from "./_generated/server";
import { v } from "convex/values";
import OpenAI from "openai";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

async function getLoggedInUser(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("User not found");
  }
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new Error("User not found");
  }
  return user;
}

/**
 * Create a channel with a given name.
 */
export const createChannel = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await getLoggedInUser(ctx);
    return await ctx.db.insert("channels", { name: args.name });
  },
});

/**
 * List the 10 most recent messages from a channel in descending creation order.
 */
export const listMessages = query({
  args: {
    channelId: v.id("channels"),
  },
  handler: async (ctx, args) => {
    await getLoggedInUser(ctx);
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_channel_and_author", (q) => q.eq("channelId", args.channelId).eq("authorId", args.authorId))
      .order("desc")
      .take(10);
    return messages;
  },
});

/**
 List the 10 most recent messages from a specific user within a specific channel
 */
export const listMessagesByUser = query({
  args: {
    channelId: v.id("channels"),
    authorId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await getLoggedInUser(ctx);
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_channel_and_author", (q) => q.eq("channelId", args.channelId).eq("authorId", args.authorId))
      .order("desc")
      .take(10);
    return messages;
  },
});

/**
 * Send a message to a channel and schedule a response from the AI.
 */
export const sendMessage = mutation({
  args: {
    channelId: v.id("channels"),
    authorId: v.id("users"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await getLoggedInUser(ctx);
    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }
    const user = await ctx.db.get(args.authorId);
    if (!user) {
      throw new Error("User not found");
    }
    await ctx.db.insert("messages", {
      channelId: args.channelId,
      authorId: args.authorId,
      content: args.content,
    });
    await ctx.scheduler.runAfter(0, internal.functions.generateResponse, {
      channelId: args.channelId,
    });
    return null;
  },
});

const openai = new OpenAI();

export const generateResponse = internalAction({
  args: {
    channelId: v.id("channels"),
  },
  handler: async (ctx, args) => {
    // IMPORTANT: Auth isn't available in \`generateResponse\` since
    // it's called by the scheduler.
    const context = await ctx.runQuery(internal.functions.loadContext, {
      channelId: args.channelId,
    });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: context,
    });
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content in response");
    }
    await ctx.runMutation(internal.functions.writeAgentResponse, {
      channelId: args.channelId,
      content,
    });
    return null;
  },
});

export const loadContext = internalQuery({
  args: {
    channelId: v.id("channels"),
  },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_channel_and_author", (q) => q.eq("channelId", args.channelId).eq("authorId", args.authorId))
      .order("desc")
      .take(10);

    const result = [];
    for (const message of messages) {
      if (message.authorId) {
        const user = await ctx.db.get(message.authorId);
        if (!user) {
          throw new Error("User not found");
        }
        result.push({
          role: "user" as const,
          content: \`\${user.name}: \${message.content}\`,
        });
      } else {
        result.push({ role: "assistant" as const, content: message.content });
      }
    }
    return result;
  },
});

export const writeAgentResponse = internalMutation({
  args: {
    channelId: v.id("channels"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("messages", {
      channelId: args.channelId,
      content: args.content,
    });
    return null;
  },
});
\`\`\`

Path: \`convex/schema.ts\`
\`\`\`ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  channels: defineTable({
    name: v.string(),
  }),

  messages: defineTable({
    channelId: v.id("channels"),
    authorId: v.optional(v.id("users")),
    content: v.string(),
  }).index("by_channel_and_author", ["channelId", "authorId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
\`\`\`

# Convex Components
Convex Components package up code and data in a sandbox that allows you to confidently and quickly add new features to your backend.
Convex Components are like mini self-contained Convex backends, and installing them is always safe. They can't read your app's tables or call your app's functions unless you pass them in explicitly.
Each component is installed as its own independent library from NPM. You also need to add a \`convex.config.ts\` file that includes the component.
ALWAYS prefer using a component for a feature than writing the code yourself, unless the component is not yet supported.
ALWAYS use the \`lookupDocs\` tool to lookup documentation for a component before trying to use the \`npmInstall\` tool to install the relevant dependencies.
You DO NOT need to deploy a component to use it. You can use it after you've installed it. You can use multiple components in the same project.

Convex has the following components:
- \`proseMirror\`: A collaborative text editor component.
- \`presence\`: A component for managing presence functionality, i.e., a live-updating list of users in a "room" including their status for when they were last online.
${options.enableResend ? resendComponent : ''}

Convex has but does not support the following components in Chef: 
DO NOT use the \`lookupDocs\` tool to lookup documentation for these or install them.
Chef does not have documentation for them. Tell the user that they are unsupported now but will be supported in the future.
- Workflow
- AI Agent
- Persistent Text Streaming
- Workpool
- Crons
- Action Retrier
- Sharded Counter
- Migrations
- Aggregate
- Geospatial
- Cloudflare R2
- Expo push notifications
- Twilio SMS
- LaunchDarkly feature flags
- Polar
- OSS stats
- Rate limiter
- Action cache
`;
}

const resendComponent = `- \`resend\`: A component for sending emails.`;
