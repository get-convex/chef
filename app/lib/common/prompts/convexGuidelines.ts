export const convexGuidelines = `# Convex guidelines

## Function guidelines

### New function syntax

- ALWAYS use the new function syntax for Convex functions. For example:

\`\`\`
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

\`\`\`
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
| Object      | Object      | \`{a: "abc"}\`           | \`v.object({property: value})\`                  | Convex only supports "plain old JavaScript objects" (objects that do not have a custom prototype). Objects can have at m
ost 1024 entries. Field names must be nonempty and not start with "$" or "_". |
| Record      | Record      | \`{"a": "1", "b": "2"}\` | \`v.record(keys, values)\`                       | Records are objects at runtime, but can have dynamic keys. Keys must be only ASCII characters, nonempty, and not start w
ith "$" or "_".

- \`v.object()\`, \`v.array()\`, \`v.boolean()\`, \`v.number()\`, \`v.string()\`, \`v.id()\`, and \`v.null()\` are the most common
  validators you'll need. Do NOT use any other validators. In particular, \`v.map()\` and \`v.set()\` are not supported.

- Below is an example of an array validator:

\`\`\`ts
import { mutation } from "./\_generated/server";
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
\`\`\`typescript
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

\`\`\`
import { mutation } from "./\_generated/server";
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

\`\`\`typescript
import { mutation } from "./\_generated/server";
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

\`\`\`
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
- Use the \`api\` object defined by the framework in \`convex/_generated/api.ts\` to call public functions registered with \`query\`, \`mutation\`, or \`action\`.
- Use the \`internal\` object defined by the framework in \`convex/_generated/api.ts\` to call internal (or private) functions registered with \`internalQuery\`, \`internalMutation\`, or \`internalAction\`.
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
- Convex automatically includes \`_creationTime\` as the final column in all indexes. Do NOT include
  \`_creationTime\` as the last column in any index you define.
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

- You can use the helper typescript type \`Id\` imported from './\_generated/dataModel' to get the type of the id for a given table. For example if there is a table called 'users' you can use \`Id<'users'>\` to get the type of the id for that table.
- If you need to define a \`Record\` make sure that you correctly provide the type of the key and value in the type. For example a validator \`v.record(v.id('users'), v.string())\` would have the type \`Record<Id<'users'>, string>\`. Below is an example of using \`Record\` with an \`Id\` type in a query:

\`\`\`
import { query } from "./\_generated/server";
import { Doc, Id } from "./\_generated/dataModel";

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

- A query for "10 messages in channel '#general' that best match the query 'hello hi' in their body" would look like:

\`\`\`
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
- Never use \`ctx.db\` inside of an action. Actions don't have access to the database.
- Below is an example of the syntax for an action:

\`\`\`
import { action } from "./\_generated/server";

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

\`\`\`
import { cronJobs } from "convex/server";
import { internal } from "./\_generated/api";
import { internalAction } from "./\_generated/server";

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
- If a cron calls an internal function, always import the \`internal\` object from '\_generated/api\`, even if the internal function is registered in the same file.

## File storage guidelines

- Convex includes file storage for large files like images, videos, and PDFs.
- The \`ctx.storage.getUrl()\` method returns a signed URL for a given file. It returns \`null\` if the file doesn't exist.
- Do NOT use the deprecated \`ctx.storage.getMetadata\` call for loading a file's metadata.

Instead, query the \`_storage\` system table. For example, you can use \`ctx.db.system.get\` to get an \`Id<"_storage">\`.

\`\`\`
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

Path: \`convex/messages.ts\`
\`\`\`
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
\`\`\`
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
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
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
    const context = await ctx.runQuery(internal.functions.loadContext, {
      channelId: args.channelId,
    });
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
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
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
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
  }).index("by_channel", ["channelId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
\`\`\`
`;
