import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  // HTTPS is required by both the Geolocation API and getUserMedia on real
  // devices (see project plan, section 3). Use `vite --host --https` with a
  // local cert, or a tunnel (ngrok/cloudflared), when testing on a phone.
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        timeline: resolve(__dirname, "timeline.html"),
        map: resolve(__dirname, "map.html"),
        backdate: resolve(__dirname, "backdate.html"),
      },
    },
  },
});
