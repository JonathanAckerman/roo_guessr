import { defineConfig } from "vite";
import { locationAuthoringPlugin } from "./scripts/location-authoring-plugin";

export default defineConfig({
  base: "/",
  plugins: [locationAuthoringPlugin()],
  build: {
    sourcemap: true,
  },
});
