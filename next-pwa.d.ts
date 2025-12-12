declare module "next-pwa" {
  import { NextConfig } from "next";

  interface PwaOptions {
    dest?: string;
    register?: boolean;
    skipWaiting?: boolean;
    disable?: boolean;
    buildExcludes?: RegExp[];
    runtimeCaching?: Array<{
      urlPattern: RegExp;
      handler: string;
      method?: string;
      options?: {
        cacheName: string;
        networkTimeoutSeconds?: number;
        expiration?: {
          maxEntries: number;
          maxAgeSeconds: number;
        };
        cacheableResponse?: {
          statuses: number[];
        };
      };
    }>;
  }

  function withPWA(options: PwaOptions): (config: NextConfig) => NextConfig;

  export default withPWA;
}
