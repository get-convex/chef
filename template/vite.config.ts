import { defineConfig, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // The code below enables dev tools like taking screenshots of your site
    // while it is being developed on chef.convex.dev.
    // Feel free to remove this code if you're no longer developing your app with Chef.
    mode === "development"
      ? {
          name: "inject-chef-dev",
          transform(code: string, id: string) {
            if (id.includes("main.tsx")) {
              return {
                code: `${code}

/* Added by Vite plugin inject-chef-dev */
window.addEventListener('message', async (message) => {
  if (message.source !== window.parent) return;
  if (message.data.type !== 'chefPreviewRequest') return;

  const worker = await import('https://chef.convex.dev/scripts/worker.bundled.mjs');
  await worker.respondToMessage(message);
});
            `,
                map: null,
              };
            }
            return null;
          },
        }
      : null,
    // Vite plugin to forward compilation errors to parent window
    mode === "development"
      ? {
          name: "chef-error-forwarder",
          configureServer(server: ViteDevServer) {
            server.ws.on("error", (error: Error) => {
              if (error.message) {
                // Note: This runs on the server side, so we can't access window
                // The error forwarding happens via the injected script in transformIndexHtml
                console.error("Vite compilation error:", error.message);
              }
            });
          },
          transformIndexHtml(html: string) {
            // Inject script to detect Vite error overlay and forward to parent
            return html.replace(
              "</head>",
              `<script>
                (function() {
                  // Function to extract error details from Vite error overlay
                  const extractErrorDetails = () => {
                    // Try multiple selectors for Vite error overlay
                    const overlay = document.querySelector('#vite-error-overlay, [id*="error"], .vite-error-overlay');
                    if (!overlay) return null;

                    // Get all text content
                    const fullText = overlay.textContent?.trim() || '';
                    if (!fullText) return null;

                    // Try to find error title (Vite uses h1 for the main error)
                    const titleEl = overlay.querySelector('h1, h2, .error-title, [class*="error-title"]');
                    let title = titleEl?.textContent?.trim() || 'Compilation Error';
                    
                    // Extract file path and message from full text
                    let message = title;
                    let file = '';
                    
                    // Split into lines for easier parsing
                    const lines = fullText.split('\\n').map(l => l.trim()).filter(l => l);
                    
                    // Look for file path pattern: /path/to/file:123:4
                    for (const line of lines) {
                      const fileMatch = line.match(/([\\/][^\\s:]+):(\\d+):(\\d+)/);
                      if (fileMatch) {
                        file = fileMatch[0];
                        break;
                      }
                    }
                    
                    // Look for error message (usually contains @apply, should not be used, or does not exist)
                    for (const line of lines) {
                      if (line.includes('@apply') || line.includes('should not be used') || 
                          line.includes('does not exist') || line.includes('postcss')) {
                        message = line;
                        break;
                      }
                    }
                    
                    // If no specific message found, use first line after title
                    if (!message || message === title) {
                      message = lines.find(l => l !== title && l.length > 10) || lines[0] || fullText.substring(0, 200);
                    }
                    
                    return {
                      title: title,
                      message: message || 'Compilation Error',
                      file: file,
                      fullText: fullText
                    };
                  };

                  // Check for errors periodically
                  let lastErrorText = '';
                  let hasSentError = false;
                  
                  const checkInterval = setInterval(() => {
                    const details = extractErrorDetails();
                    if (details && details.fullText && details.fullText !== lastErrorText) {
                      lastErrorText = details.fullText;
                      hasSentError = true;
                      
                      if (window.parent && window.parent !== window) {
                        window.parent.postMessage({
                          type: 'VITE_COMPILATION_ERROR',
                          error: details.title,
                          message: details.message || details.title,
                          file: details.file,
                          stack: details.fullText
                        }, '*');
                      }
                    } else if (!details && hasSentError) {
                      // Error was fixed, reset
                      hasSentError = false;
                      lastErrorText = '';
                    }
                  }, 500); // Check every 500ms for faster detection

                  // Listen for error events (catches PostCSS and other errors)
                  window.addEventListener('error', (e) => {
                    const errorMsg = e.message || '';
                    const isViteError = errorMsg.includes('vite') || 
                                       errorMsg.includes('postcss') || 
                                       errorMsg.includes('does not exist') ||
                                       errorMsg.includes('@apply') ||
                                       errorMsg.includes('should not be used');
                    
                    if (isViteError && window.parent && window.parent !== window) {
                      window.parent.postMessage({
                        type: 'VITE_COMPILATION_ERROR',
                        error: errorMsg,
                        message: errorMsg,
                        file: e.filename || '',
                        line: e.lineno || '',
                        stack: e.error?.stack || errorMsg
                      }, '*');
                    }
                  });

                  // Also listen for unhandled promise rejections (catches async errors)
                  window.addEventListener('unhandledrejection', (e) => {
                    const errorMsg = String(e.reason || e);
                    const isViteError = errorMsg.includes('vite') || 
                                       errorMsg.includes('postcss') || 
                                       errorMsg.includes('@apply');
                    
                    if (isViteError && window.parent && window.parent !== window) {
                      window.parent.postMessage({
                        type: 'VITE_COMPILATION_ERROR',
                        error: errorMsg,
                        message: errorMsg,
                        file: '',
                        line: '',
                        stack: errorMsg
                      }, '*');
                    }
                  });
                })();
              </script>
              </head>`
            );
          },
        }
      : null,
    // End of code for taking screenshots on chef.convex.dev.
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
