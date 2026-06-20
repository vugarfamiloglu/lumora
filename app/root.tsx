import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "@remix-run/react";
import type { LinksFunction } from "@remix-run/node";
import tokens from "./styles/tokens.css?url";
import shell from "./styles/shell.css?url";
import ui from "./styles/ui.css?url";

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Spline+Sans:wght@400;500;600;700&family=Inter:wght@400;450;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap" },
  { rel: "icon", href: "/logo.svg", type: "image/svg+xml" },
  { rel: "stylesheet", href: tokens },
  { rel: "stylesheet", href: shell },
  { rel: "stylesheet", href: ui },
];

// Apply the saved theme before paint to avoid a flash.
const themeScript = `(function(){try{var t=localStorage.getItem('lumora.theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
