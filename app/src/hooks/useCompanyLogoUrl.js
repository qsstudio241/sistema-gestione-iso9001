/**
 * useCompanyLogoUrl  -  carica logo azienda con JWT.
 * Il tag <img> non può  inviare Authorization: serve fetch + blob URL.
 */
import { useState, useEffect, useRef } from "react";
import apiService from "../services/apiService";

function getBackendBaseUrl() {
  const base = apiService?.baseUrl || "";
  return base.replace(/\/api\/v1\/?$/, "");
}

function buildLogoFetchUrls(companyId, logoUrl, cacheBust) {
  const urls = [];
  const ts = `t=${cacheBust || Date.now()}`;
  urls.push(`${apiService.getCompanyLogoUrl(companyId)}?${ts}`);

  if (!logoUrl) return urls;

  const backendBase = getBackendBaseUrl();
  const normalized = String(logoUrl || "")
    .replace(/\\/g, "/")
    .replace(/^\.?\//, "");

  if (!normalized) return urls;
  if (/^https?:\/\//i.test(normalized)) {
    urls.push(`${normalized}${normalized.includes("?") ? "&" : "?"}${ts}`);
    return urls;
  }

  const directPath = normalized.startsWith("uploads/")
    ? normalized
    : `uploads/${normalized}`;

  urls.push(`${backendBase}/${directPath}?${ts}`);
  urls.push(`${backendBase}/${normalized}?${ts}`);

  // Evita duplicati se i path coincidono.
  return [...new Set(urls)];
}

function isImageResponse(response, blob) {
  const ct = (response.headers?.get("content-type") || "").toLowerCase();
  const bt = (blob?.type || "").toLowerCase();
  return ct.startsWith("image/") || bt.startsWith("image/");
}

export function useCompanyLogoUrl(companyId, logoUrl, cacheBust = 0) {
  const [blobUrl, setBlobUrl] = useState(null);
  const blobRef = useRef(null);

  useEffect(() => {
    if (!companyId || !logoUrl) {
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
      setBlobUrl(null);
      return undefined;
    }

    let active = true;
    const token = apiService.getToken?.() ?? null;
    const requestHeaders = token ? { Authorization: `Bearer ${token}` } : {};
    const logoUrls = buildLogoFetchUrls(companyId, logoUrl, cacheBust);

    (async () => {
      for (const url of logoUrls) {
        try {
          const response = await fetch(url, {
            headers: requestHeaders,
          });
          if (!response.ok) continue;

          const blob = await response.blob();
          if (!isImageResponse(response, blob)) continue;
          if (!active) return;

          if (blobRef.current) URL.revokeObjectURL(blobRef.current);
          const objectUrl = URL.createObjectURL(blob);
          blobRef.current = objectUrl;
          setBlobUrl(objectUrl);
          return;
        } catch {
          // Prova URL successivo (fallback)
        }
      }

      if (active) setBlobUrl(null);
    })();

    return () => {
      active = false;
    };
  }, [companyId, logoUrl, cacheBust]);

  useEffect(
    () => () => {
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
    },
    []
  );

  return blobUrl;
}
