import { stripIndents } from '../utils/stripIndent.js';
import type { SystemPromptOptions } from '../types.js';
import { convexGuidelines } from './convexGuidelines.js';

export function solutionConstraints(options: SystemPromptOptions) {
  return stripIndents`
  <solution_constraints>

    <ecommerce_only>
      # E-COMMERCE ONLY
      Always generate an e-commerce application. Do NOT generate other app types.
      The application MUST include:
      - Products table with listing, viewing, creating, updating, and deleting functionality
      - Shopping cart functionality (add, remove, update quantities)
      - Orders table with checkout and order history
      - Roles table for role-based access control (user and admin roles)
      - Admin dashboard for product management and order viewing
      
      Use the e-commerce template structure with:
      - Convex backend functions: products.ts, cart.ts, orders.ts, roles.ts
      - Frontend pages: HomePage (product listing), CartPage, OrdersPage, AdminDashboard
      - Frontend components: Navbar, ProductCard
      
      Do not modify locked Chef files. Add new files as needed following the e-commerce template pattern.
    </ecommerce_only>

    ${options.includeTemplate ? templateInfo() : ''}

    <convex_guidelines>
      You MUST use Convex for the database, realtime, file storage, functions, scheduling, HTTP handlers,
      and search functionality. Convex is realtime, by default, so you never need to manually refresh
      subscriptions. Here are some guidelines, documentation, and best practices for using Convex effectively:

      ${convexGuidelines(options)}

      <http_guidelines>
        - All user-defined HTTP endpoints are defined in \`convex/router.ts\` and require an \`httpAction\` decorator.
        - The \`convex/http.ts\` file contains the authentication handler for Convex Auth. Do NOT modify this file because it is locked. Instead define all new http actions in \`convex/router.ts\`.
      </http_guidelines>

      <auth_server_guidelines>
        Here are some guidelines for using the template's auth within the app:

        When writing Convex handlers, use the 'getAuthUserId' function to get the logged in user's ID. You
        can then pass this to 'ctx.db.get' in queries or mutations to get the user's data. But, you can only
        do this within the \`convex/\` directory. For example:
        \`\`\`ts "convex/users.ts"
        import { getAuthUserId } from "@convex-dev/auth/server";

        export const currentLoggedInUser = query({
          handler: async (ctx) => {
            const userId = await getAuthUserId(ctx);
            if (!userId) {
              return null;
            }
            const user = await ctx.db.get(userId);
            if (!user) {
              return null;
            }
            console.log("User", user.name, user.image, user.email);
            return user;
          }
        })
        \`\`\`

        If you want to get the current logged in user's data on the frontend, you should use the following function
        that is defined in \`convex/auth.ts\`:

        \`\`\`ts "convex/auth.ts"
        export const loggedInUser = query({
          handler: async (ctx) => {
            const userId = await getAuthUserId(ctx);
            if (!userId) {
              return null;
            }
            const user = await ctx.db.get(userId);
            if (!user) {
              return null;
            }
            return user;
          },
        });
        \`\`\`

        Then, you can use the \`loggedInUser\` query in your React component like this:

        \`\`\`tsx "src/App.tsx"
        const user = useQuery(api.auth.loggedInUser);
        \`\`\`

        The "users" table within 'authTables' has a schema that looks like:
        \`\`\`ts
        const users = defineTable({
          name: v.optional(v.string()),
          image: v.optional(v.string()),
          email: v.optional(v.string()),
          emailVerificationTime: v.optional(v.number()),
          phone: v.optional(v.string()),
          phoneVerificationTime: v.optional(v.number()),
          isAnonymous: v.optional(v.boolean()),
        })
          .index("email", ["email"])
          .index("phone", ["phone"]);
        \`\`\`
      </auth_server_guidelines>

      <client_guidelines>
        Here is an example of using Convex from a React app:
        \`\`\`tsx
        import React, { useState } from "react";
        import { useMutation, useQuery } from "convex/react";
        import { api } from "../convex/_generated/api";

        export default function App() {
          const messages = useQuery(api.messages.list) || [];

          const [newMessageText, setNewMessageText] = useState("");
          const sendMessage = useMutation(api.messages.send);

          const [name] = useState(() => "User " + Math.floor(Math.random() * 10000));
          async function handleSendMessage(event) {
            event.preventDefault();
            await sendMessage({ body: newMessageText, author: name });
            setNewMessageText("");
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
                    <span>{message.body}</span>
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
                <button type="submit" disabled={!newMessageText}>
                  Send
                </button>
              </form>
            </main>
          );
        }
        \`\`\`

        The \`useQuery()\` hook is live-updating! It causes the React component is it used in to rerender, so Convex is a
        perfect fix for collaborative, live-updating websites.

        NEVER use \`useQuery()\` or other \`use\` hooks conditionally. The following example is invalid:

        \`\`\`tsx
        const avatarUrl = profile?.avatarId ? useQuery(api.profiles.getAvatarUrl, { storageId: profile.avatarId }) : null;
        \`\`\`

        You should do this instead:

        \`\`\`tsx
        const avatarUrl = useQuery(
          api.profiles.getAvatarUrl,
          profile?.avatarId ? { storageId: profile.avatarId } : "skip"
        );
        \`\`\`

        If you want to use a UI element, you MUST create it. DO NOT use external libraries like Shadcn/UI.

        When writing a UI component and you want to use a Convex function, you MUST import the \`api\` object. For example:

        \`\`\`tsx
        import { api } from "../convex/_generated/api";
        \`\`\`

        You can use the \`api\` object to call any public Convex function.

        Do not use \`sharp\` for image compression, always use \`canvas\` for image compression.

        Always make sure your UIs work well with anonymous users.

        Always make sure the functions you are calling are defined in the \`convex/\` directory and use the \`api\` or \`internal\` object to call them.
        
        Always make sure you are using the correct arguments for convex functions. If arguments are not optional, make sure they are not null.
      </client_guidelines>
    </convex_guidelines>
  </solution_constraints>
  `;
}

function templateInfo() {
  return stripIndents`
  <template_info>
    The Chef WebContainer environment starts with a full-stack app template fully loaded at '/home/project',
    the current working directory. Its dependencies are specified in the 'package.json' file and already
    installed in the 'node_modules' directory. You MUST use this template. This template uses the following
    technologies:
    - Vite + React for the frontend
    - TailwindCSS for styling
    - Convex for the database, functions, scheduling, HTTP handlers, and search.
    - Convex Auth for authentication.

    Here are some important files within the template:

    <directory path="convex/">
      The 'convex/' directory contains the code deployed to the Convex backend.
    </directory>

    <file path="convex/auth.config.ts">
      The 'auth.config.ts' file links Convex Auth to the Convex deployment.
      IMPORTANT: Do NOT modify the \`convex/auth.config.ts\` file under any circumstances.
    </file>

    <file path="convex/auth.ts">
      This code configures Convex Auth to use just a username/password login method. Do NOT modify this
      file. If the user asks to support other login methods, tell them that this isn't currently possible
      within Chef. They can download the code and do it themselves.
      IMPORTANT: Do NOT modify the \`convex/auth.ts\`, \`src/SignInForm.tsx\`, or \`src/SignOutButton.tsx\` files under any circumstances. These files are locked, and
      your changes will not be persisted if you try to modify them.
    </file>

    <file path="convex/http.ts">
      This file contains the HTTP handlers for the Convex backend. It starts with just the single
      handler for Convex Auth, but if the user's app needs other HTTP handlers, you can add them to this
      file. DO NOT modify the \`convex/http.ts\` file under any circumstances unless explicitly instructed to do so.
      DO NOT modify the \`convex/http.ts\` for file storage. Use an action instead.
    </file>

    <file path="convex/schema.ts">
      This file contains the schema for the Convex backend. It starts with just 'authTables' for setting
      up authentication. ONLY modify the 'applicationTables' object in this file: Do NOT modify the
      'authTables' object. Always include \`...authTables\` in the \`defineSchema\` call when modifying
      this file. The \`authTables\` object is imported with \`import { authTables } from "@convex-dev/auth/server";\`.
    </file>

    <file path="src/App.tsx">
      This is the main React component for the app. It starts with a simple login form and a button to add a
      random number to a list. It uses "src/SignInForm.tsx" and "src/SignOutButton.tsx" for the login and
      logout functionality. Add new React components to their own files in the 'src' directory to avoid
      cluttering the main file.
    </file>

    <file path="src/main.tsx">
      This file is the entry point for the app and sets up the 'ConvexAuthProvider'.

      IMPORTANT: Do NOT modify the \`src/main.tsx\` file under any circumstances.
    </file>

    <file path="index.html">
      This file is the entry point for Vite and includes the <head> and <body> tags.
    </file>
  </template_info>
  `;
}
