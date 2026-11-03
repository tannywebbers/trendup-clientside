export function getGoogleClientId(adCode: string): string | null {
  const m = adCode.match(/data-ad-client=["']?([^"'\s>]+)/);
  return m ? m[1] : null;
}

let googleScriptPromise: Promise<void> | null = null;

export function ensureGoogleAdScript(clientId: string): void {
  if (document.querySelector("script[data-google-adsbygoogle]")) return;
  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve) => {
      const s = document.createElement("script");
      s.async = true;
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
      s.crossOrigin = "anonymous";
      s.setAttribute("data-google-adsbygoogle", "1");
      s.onload = () => resolve();
      s.onerror = () => resolve();
      document.head.appendChild(s);
    });
  }
}