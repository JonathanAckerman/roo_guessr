import { defineConfig } from "vite";

export default defineConfig({
  base: "/",
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "assets/app.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: (assetInfo) => {
          const emittedName = assetInfo.names[0] ?? "asset";

          if (emittedName.endsWith(".css")) return "assets/app.css";

          const originalName = assetInfo.originalFileNames[0]?.replaceAll("\\", "/");
          const sourcePath = originalName?.startsWith("src/")
            ? originalName.slice("src/".length)
            : originalName?.split("/src/").at(-1);

          if (sourcePath?.startsWith("locations/")) return `assets/${sourcePath}`;
          if (sourcePath?.startsWith("assets/")) return `assets/${sourcePath.slice("assets/".length)}`;

          return `assets/${emittedName}`;
        },
      },
    },
    sourcemap: true,
  },
});
