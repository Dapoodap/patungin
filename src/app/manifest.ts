import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Patungin — Split Bill Indonesia",
    short_name: "Patungin",
    description: "Aplikasi Split Bill & Patungan Indonesia Tanpa Drama",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFDF5",
    theme_color: "#FFE600",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
