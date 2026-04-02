import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { weather_forecast } from "../db/schema";
import type { Env } from "../types";

export const weatherRoutes = new Hono<{ Bindings: Env }>();

weatherRoutes.get("/forecast", async (c) => {
  const baseUrl = c.env.WEATHER_API_BASE_URL || "https://api.weather.gov";
  const db = drizzle(c.env.DB);

  try {
    const response = await fetch(
      `${baseUrl}/gridpoints/LWX/96,70/forecast`,
      {
        headers: {
          "User-Agent": "parable-service-cloudflare",
          Accept: "application/geo+json",
        },
      }
    );

    if (!response.ok) {
      return c.json(
        { error: "Weather API unavailable", status: response.status },
        502
      );
    }

    const data = (await response.json()) as {
      properties?: {
        periods?: Array<{
          startTime: string;
          temperature: number;
          temperatureUnit: string;
        }>;
      };
    };

    const periods = data.properties?.periods ?? [];

    // Cache in D1
    const batch = periods.slice(0, 24).map((period) => ({
      time: period.startTime,
      temperature: `${period.temperature}${period.temperatureUnit}`,
      updated_at: new Date().toISOString(),
    }));

    if (batch.length > 0) {
      // Clear old data and insert new
      await db.delete(weather_forecast);
      for (const entry of batch) {
        await db.insert(weather_forecast).values(entry);
      }
    }

    return c.json({
      forecast: periods.slice(0, 24).map((p) => ({
        time: p.startTime,
        temperature: `${p.temperature}${p.temperatureUnit}`,
      })),
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Weather fetch error:", err);
    // Serve cached data on failure
    const cached = await db.select().from(weather_forecast).limit(24);
    if (cached.length > 0) {
      return c.json({
        forecast: cached,
        source: "cache",
        updated_at: cached[0].updated_at,
      });
    }
    return c.json({ error: "Weather data unavailable" }, 503);
  }
});
