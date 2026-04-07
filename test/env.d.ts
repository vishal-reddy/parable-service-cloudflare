declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      ENVIRONMENT: string;
      KINDE_DOMAIN: string;
      KINDE_CLIENT_ID: string;
      KINDE_CLIENT_SECRET: string;
      KINDE_REDIRECT_URI: string;
      KINDE_LOGOUT_REDIRECT_URI: string;
      KINDE_AUDIENCE: string;
      WEATHER_API_BASE_URL: string;
      SESSION_SECRET: string;
    }
  }
}

export {};
