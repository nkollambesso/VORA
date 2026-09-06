import { Driver, MarkerData } from "@/types/type";

const directionsAPI = process.env.EXPO_PUBLIC_DIRECTIONS_API_KEY;
const geoapifyAPI = process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY || directionsAPI;

// Helper to calculate approximate distance (Haversine formula in km)
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const generateMarkersFromData = ({
  data,
  userLatitude,
  userLongitude,
}: {
  data: Driver[];
  userLatitude: number;
  userLongitude: number;
}): MarkerData[] => {
  return data.map((driver) => {
    const latOffset = (Math.random() - 0.5) * 0.01;
    const lngOffset = (Math.random() - 0.5) * 0.01;

    return {
      latitude: userLatitude + latOffset,
      longitude: userLongitude + lngOffset,
      title: `${driver.first_name} ${driver.last_name}`,
      ...driver,
    };
  });
};

export const calculateRegion = ({
  userLatitude,
  userLongitude,
  destinationLatitude,
  destinationLongitude,
}: {
  userLatitude: number | null;
  userLongitude: number | null;
  destinationLatitude?: number | null;
  destinationLongitude?: number | null;
}) => {
  if (!userLatitude || !userLongitude) {
    return {
      latitude: 3.848,
      longitude: 11.502,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }

  if (!destinationLatitude || !destinationLongitude) {
    return {
      latitude: userLatitude,
      longitude: userLongitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }

  const minLat = Math.min(userLatitude, destinationLatitude);
  const maxLat = Math.max(userLatitude, destinationLatitude);
  const minLng = Math.min(userLongitude, destinationLongitude);
  const maxLng = Math.max(userLongitude, destinationLongitude);

  const latitudeDelta = (maxLat - minLat) * 1.3;
  const longitudeDelta = (maxLng - minLng) * 1.3;

  const latitude = (userLatitude + destinationLatitude) / 2;
  const longitude = (userLongitude + destinationLongitude) / 2;

  return {
    latitude,
    longitude,
    latitudeDelta,
    longitudeDelta,
  };
};

export const calculateDriverTimes = async ({
  markers,
  userLatitude,
  userLongitude,
  destinationLatitude,
  destinationLongitude,
}: {
  markers: MarkerData[];
  userLatitude: number | null;
  userLongitude: number | null;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
}) => {
  if (
    !userLatitude ||
    !userLongitude ||
    !destinationLatitude ||
    !destinationLongitude
  )
    return;

  try {
    const timesPromises = markers.map(async (marker) => {
      let timeToUser = 5; // default 5 mins
      let timeToDestination = 15; // default 15 mins

      // 1. Try Geoapify Routing API first
      if (geoapifyAPI && geoapifyAPI.length > 10) {
        try {
          const resToUser = await fetch(
            `https://api.geoapify.com/v1/routing?waypoints=${marker.latitude},${marker.longitude}|${userLatitude},${userLongitude}&mode=drive&apiKey=${geoapifyAPI}`
          );
          const dataUser = await resToUser.json();
          if (dataUser?.features?.[0]?.properties?.time) {
            timeToUser = dataUser.features[0].properties.time / 60;
          }

          const resToDest = await fetch(
            `https://api.geoapify.com/v1/routing?waypoints=${userLatitude},${userLongitude}|${destinationLatitude},${destinationLongitude}&mode=drive&apiKey=${geoapifyAPI}`
          );
          const dataDest = await resToDest.json();
          if (dataDest?.features?.[0]?.properties?.time) {
            timeToDestination = dataDest.features[0].properties.time / 60;
          }
        } catch (e) {
          // Fall through to Haversine
        }
      }

      // 2. Fallback to Haversine calculation if API didn't return values
      if (timeToUser === 5 && timeToDestination === 15) {
        const distToUser = calculateHaversineDistance(marker.latitude, marker.longitude, userLatitude, userLongitude);
        const distToDest = calculateHaversineDistance(userLatitude, userLongitude, destinationLatitude, destinationLongitude);
        
        // Assume avg speed ~ 30 km/h in urban traffic -> ~2 mins per km
        timeToUser = Math.max(2, Math.round(distToUser * 2));
        timeToDestination = Math.max(5, Math.round(distToDest * 2));
      }

      const totalTime = Math.round(timeToUser + timeToDestination);
      const price = Math.max(500, Math.round(totalTime * 150)); // Price in XAF / local currency units or standard rate

      return { ...marker, time: totalTime, price: price.toString() };
    });

    return await Promise.all(timesPromises);
  } catch (error) {
    console.error("Error calculating driver times:", error);
  }
};
