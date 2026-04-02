import { html } from "hono/html";

export function layout(
  title: string,
  content: unknown
) {
  return html`<!DOCTYPE html>
    <html lang="en" class="h-full">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title} | Parable Service</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Titillium+Web:wght@300;400;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/css/output.css" />
        <script
          defer
          src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"
        ></script>
        <script src="https://unpkg.com/htmx.org@2.0.4"></script>
        <script src="/js/theme.js"></script>
      </head>
      <body
        class="h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans"
        x-data
      >
        <nav
          class="border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between"
        >
          <a href="/" class="text-xl font-bold">🎭 Parable</a>
          <div class="flex items-center gap-4">
            <button
              @click="$store.theme.dark ? $store.theme.lightTheme() : $store.theme.darkTheme()"
              class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <span x-show="$store.theme.dark">☀️</span>
              <span x-show="!$store.theme.dark">🌙</span>
            </button>
          </div>
        </nav>
        <main class="max-w-4xl mx-auto px-6 py-8">${content}</main>
      </body>
    </html>`;
}
