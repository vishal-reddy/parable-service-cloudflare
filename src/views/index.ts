import { html } from "hono/html";
import type { Context } from "hono";
import { layout } from "./layout";
import type { Env } from "../types";

export async function indexPage(c: Context<{ Bindings: Env }>) {
  // Check for session cookie
  const cookie = c.req.header("Cookie");
  let user: { sub?: string; email?: string } | null = null;

  if (cookie) {
    const sessionMatch = cookie.match(/session=([^;]+)/);
    if (sessionMatch) {
      try {
        const decoded = JSON.parse(atob(sessionMatch[1]));
        if (decoded.access_token) {
          const claims = JSON.parse(
            atob(decoded.access_token.split(".")[1])
          );
          user = { sub: claims.sub, email: claims.email };
        }
      } catch {
        // Invalid session
      }
    }
  }

  const content = user
    ? html`
        <div class="space-y-6">
          <h1 class="text-3xl font-bold">Welcome back</h1>
          <p class="text-gray-600 dark:text-gray-400">
            Signed in as
            <span class="font-semibold">${user.email ?? user.sub}</span>
          </p>
          <div class="flex gap-4">
            <a
              href="/logout"
              class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >Logout</a
            >
          </div>
          <div class="mt-8 grid gap-4 md:grid-cols-2">
            <div class="p-6 border rounded-lg dark:border-gray-700">
              <h2 class="text-lg font-semibold mb-2">📚 Puritan Library</h2>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Search and browse the digitized Puritan theological works
              </p>
            </div>
            <div class="p-6 border rounded-lg dark:border-gray-700">
              <h2 class="text-lg font-semibold mb-2">📖 Stories</h2>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Manage your story structures with acts, beats, and characters
              </p>
            </div>
            <div class="p-6 border rounded-lg dark:border-gray-700">
              <h2 class="text-lg font-semibold mb-2">📊 Assessments</h2>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Review AI session grading and ethical compliance scores
              </p>
            </div>
            <div class="p-6 border rounded-lg dark:border-gray-700">
              <h2 class="text-lg font-semibold mb-2">🌤 Weather</h2>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Current weather forecast data
              </p>
            </div>
          </div>
        </div>
      `
    : html`
        <div class="space-y-6 text-center py-16">
          <h1 class="text-4xl font-bold">🎭 Parable Service</h1>
          <p class="text-lg text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
            A cost-optimized edge service for story management, Puritan library
            search, and AI assessment grading — powered by Cloudflare Workers.
          </p>
          <div class="flex gap-4 justify-center">
            <a
              href="/login"
              class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
              >Login</a
            >
            <a
              href="/signup"
              class="px-6 py-3 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-800 font-semibold"
              >Sign Up</a
            >
          </div>
        </div>
      `;

  return c.html(layout("Home", content));
}
