import { ScrollViewStyleReset } from "expo-router/html";
import React from "react";

/**
 * This file is web-only and used to configure the root HTML for every web page during static rendering.
 * The contents of this function only run in Node.js environments and do not have access to the DOM or browser APIs.
 */
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />

        {/*
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native.
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {/* PWA & Mobile Web App Meta */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0EA5E9" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="VORA" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />

        {/* Using raw CSS styles as an escape-hatch to ensure the background color never flickers in dark-mode. */}
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        {/* Add any additional <head> elements that you want globally available on web... */}
      </head>
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    console.log('[VORA PWA] SW registered:', reg.scope);
                  }).catch(function(err) {
                    console.warn('[VORA PWA] SW registration failed:', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}

const responsiveBackground = `
html, body {
  height: 100%;
  margin: 0;
  padding: 0;
}

@media (min-width: 501px) {
  body {
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle at 50% 25%, #1e293b 0%, #0f172a 60%, #020617 100%) !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    overflow: hidden;
  }
  #root {
    width: 414px !important;
    height: 896px !important;
    max-height: 94vh !important;
    border-radius: 48px !important;
    border: 12px solid #1e293b !important;
    box-shadow: 
      0 25px 70px -10px rgba(0, 0, 0, 0.75),
      0 0 0 1px rgba(255, 255, 255, 0.12),
      0 0 40px rgba(14, 165, 233, 0.15) !important;
    overflow: hidden !important;
    position: relative !important;
    background-color: #ffffff !important;
    margin: auto !important;
    display: flex !important;
    flex-direction: column !important;
  }
}

@media (max-width: 500px) {
  html, body {
    background-color: #ffffff !important;
  }
  #root {
    height: 100% !important;
    width: 100% !important;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    background-color: #ffffff !important;
  }
}`;
