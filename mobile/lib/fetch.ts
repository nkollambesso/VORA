import { useState, useEffect, useCallback } from "react";
import { getBackendUrl } from "./config";

const DEFAULT_FALLBACK_DRIVERS = [
  {
    id: 1,
    first_name: "Grégoire",
    last_name: "Legrand",
    profile_image_url: "https://th.bing.com/th/id/OIP.DvI5lVNuJSFqe-7foM3tPQAAAA?w=175&h=180&c=7&r=0&o=7&dpr=1.3&pid=1.7&rm=3",
    car_image_url: "https://ucarecdn.com/a2dc52b2-8bf7-4e19-9a70-388147d3e696/-/preview/465x466/",
    car_seats: 4,
    rating: 4.90,
  },
  {
    id: 2,
    first_name: "Amassoka",
    last_name: "Michelle",
    profile_image_url: "https://api.dicebear.com/7.x/shapes/png?seed=VoraMichelle&backgroundColor=10b981",
    car_image_url: "https://ucarecdn.com/dae9be8a-fc66-43c0-988b-b37e1f7d1788/-/preview/1000x1000/",
    car_seats: 4,
    rating: 4.85,
  },
];

export const fetchAPI = async (url: string, options?: RequestInit) => {
  try {
    const backendUrl = getBackendUrl();
    let resolvedUrl = url;

    // Rediriger les appels /(api)/ vers l'API backend Express réelle
    if (url.startsWith("/(api)/driver") || url === "/api/driver") {
      try {
        const res = await fetch(`${backendUrl}/api/drivers/online`, options);
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.drivers) && json.drivers.length > 0) {
            const formatted = json.drivers.map((d: any) => {
              const parts = (d.display_name || "Chauffeur VORA").split(" ");
              return {
                id: d.id,
                first_name: parts[0] || "Chauffeur",
                last_name: parts.slice(1).join(" ") || "VORA",
                profile_image_url: d.avatar_url || "https://api.dicebear.com/7.x/shapes/png?seed=DriverVora&backgroundColor=0ea5e9",
                car_image_url: "https://ucarecdn.com/a2dc52b2-8bf7-4e19-9a70-388147d3e696/-/preview/465x466/",
                car_seats: d.vehicle_type === "moto" ? 1 : 4,
                rating: parseFloat(d.rating) || 5.0,
              };
            });
            return { data: formatted };
          }
        }
      } catch (e) {
        console.warn("Chauffeurs distants inaccessibles, chargement chauffeurs de secours:", e);
      }
      return { data: DEFAULT_FALLBACK_DRIVERS };
    }

    if (url.startsWith("/(api)/ride/create")) {
      resolvedUrl = `${backendUrl}/api/rides`;
    } else if (url.startsWith("/(api)/ride/")) {
      const userId = url.replace("/(api)/ride/", "");
      if (!userId || userId === "undefined" || userId === "null") {
        return { data: [] };
      }
      try {
        const res = await fetch(`${backendUrl}/api/rides/user/${userId}`, options);
        if (res.ok) {
          const json = await res.json();
          const list = json.rides || json.data || [];
          const formattedRides = list.map((r: any) => {
            const driverParts = (r.driver_name || "Chauffeur VORA").split(" ");
            return {
              origin_address: r.origin_address,
              destination_address: r.destination_address,
              origin_latitude: r.origin_lat,
              origin_longitude: r.origin_lng,
              destination_latitude: r.dest_lat,
              destination_longitude: r.dest_lng,
              ride_time: 15,
              fare_price: r.fare_fcfa,
              payment_status: r.payment_status?.toLowerCase() === "paid" ? "paid" : "pending",
              driver_id: r.driver_id || 1,
              user_id: r.rider_id,
              created_at: r.created_at,
              driver: {
                first_name: driverParts[0] || "Chauffeur",
                last_name: driverParts.slice(1).join(" ") || "VORA",
                car_seats: r.vehicle_type === "moto" ? 1 : 4,
              },
            };
          });
          return { data: formattedRides };
        }
      } catch (e) {
        console.warn("Historique courses inaccessible:", e);
        return { data: [] };
      }
      return { data: [] };
    } else if (url.startsWith("/(api)/user")) {
      resolvedUrl = `${backendUrl}/api/users`;
    }

    const response = await fetch(resolvedUrl, options);
    const text = await response.text();

    // Protection contre les réponses HTML (ex: 404/500 de dev server)
    if (text.trim().startsWith("<")) {
      console.warn("Réponse HTML inattendue pour l'API:", resolvedUrl);
      return { data: [] };
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return JSON.parse(text);
  } catch (error) {
    console.error("Fetch error:", error);
    return { data: [] };
  }
};

export const useFetch = <T>(url: string, options?: RequestInit) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!url || url.includes("/undefined") || url.includes("/null")) {
      setLoading(false);
      setData([] as unknown as T);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchAPI(url, options);
      setData(result?.data ?? result ?? ([] as unknown as T));
    } catch (err) {
      setError((err as Error).message);
      setData([] as unknown as T);
    } finally {
      setLoading(false);
    }
  }, [url, options]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
};
