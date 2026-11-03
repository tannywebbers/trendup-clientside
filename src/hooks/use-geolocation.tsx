import { useEffect, useState } from "react";

interface GeolocationResult {
  country: string | null;
  loading: boolean;
  error: string | null;
}

export function useGeolocation(): GeolocationResult {
  const [country, setCountry] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const detectCountry = async () => {
      try {
        // Use IP-based geolocation service
        const response = await fetch("https://ipapi.co/json/");
        if (!response.ok) throw new Error("Geolocation failed");
        
        const data = await response.json();
        setCountry(data.country_name || data.country || null);
      } catch (err) {
        console.error("Geolocation error:", err);
        setError("Unable to detect location");
        setCountry(null);
      } finally {
        setLoading(false);
      }
    };

    detectCountry();
  }, []);

  return { country, loading, error };
}

export async function getCountryFromIP(): Promise<string | null> {
  try {
    const response = await fetch("https://ipapi.co/json/");
    if (!response.ok) return null;
    
    const data = await response.json();
    return data.country_name || data.country || null;
  } catch {
    return null;
  }
}