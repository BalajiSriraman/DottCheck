import { getDistanceMeters } from './geo';
import type {
  Coordinates,
  DottSummary,
  StationInformation,
  StationStatus,
  Vehicle
} from './types';

const BASE_URL = 'https://gbfs.api.ridedott.com/public/v2';

type FeedMap = Record<string, string>;

const readJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return (await response.json()) as T;
};

const resolveFeedUrl = async (citySlug: string, feedName: string): Promise<string | null> => {
  const gbfs = await readJson<{ data: { en?: { feeds: Array<{ name: string; url: string }> } } }>(
    `${BASE_URL}/${citySlug}/gbfs.json`
  );

  const feeds = gbfs.data.en?.feeds ?? [];
  const index: FeedMap = Object.fromEntries(feeds.map((feed) => [feed.name, feed.url]));

  return index[feedName] ?? null;
};

const countByDistance = <T extends { lat: number; lon: number }>(
  items: T[],
  target: Coordinates,
  radiusMeters: number
): T[] =>
  items.filter(
    (item) =>
      getDistanceMeters(target, {
        latitude: item.lat,
        longitude: item.lon
      }) <= radiusMeters
  );

export const getCitiesForCountry = async (countryCode: string): Promise<string[]> => {
  const payload = await readJson<{
    data: {
      [language: string]: {
        feeds: Array<{ name: string; url: string }>;
      };
    };
  }>(`${BASE_URL}/countries/${countryCode}/gbfs.json`);

  const feeds = payload.data.en?.feeds ?? [];

  return feeds
    .map((feed) => {
      const match = feed.url.match(/public\/v2\/([^/]+)\/gbfs\.json$/);
      return match?.[1] ?? null;
    })
    .filter((city): city is string => Boolean(city));
};

export const getNearbySummary = async (
  citySlug: string,
  center: Coordinates,
  radiusMeters: number
): Promise<DottSummary> => {
  const [freeBikeStatusUrl, stationInfoUrl, stationStatusUrl] = await Promise.all([
    resolveFeedUrl(citySlug, 'free_bike_status'),
    resolveFeedUrl(citySlug, 'station_information'),
    resolveFeedUrl(citySlug, 'station_status')
  ]);

  if (!freeBikeStatusUrl) {
    throw new Error(`No free_bike_status feed found for city ${citySlug}`);
  }

  const freeBikeStatus = await readJson<{ data: { bikes: Vehicle[] } }>(freeBikeStatusUrl);
  const nearbyVehicles = countByDistance(freeBikeStatus.data.bikes ?? [], center, radiusMeters).filter(
    (bike) => bike.is_disabled !== 1
  );

  const scooterCount = nearbyVehicles.filter((vehicle) =>
    vehicle.vehicle_type_id?.toLowerCase().includes('scooter')
  ).length;
  const bikeCount = nearbyVehicles.filter((vehicle) =>
    vehicle.vehicle_type_id?.toLowerCase().includes('bike')
  ).length;

  let parkingZoneCount = 0;
  let availableDockCount = 0;

  if (stationInfoUrl) {
    const stationInfo = await readJson<{ data: { stations: StationInformation[] } }>(stationInfoUrl);
    const nearbyStations = countByDistance(stationInfo.data.stations ?? [], center, radiusMeters);
    parkingZoneCount = nearbyStations.length;

    if (stationStatusUrl && nearbyStations.length > 0) {
      const stationStatus = await readJson<{ data: { stations: StationStatus[] } }>(stationStatusUrl);
      const docksByStation = new Map<string, number>(
        (stationStatus.data.stations ?? []).map((station) => [station.station_id, station.num_docks_available ?? 0])
      );

      availableDockCount = nearbyStations.reduce(
        (sum, station) => sum + (docksByStation.get(station.station_id) ?? 0),
        0
      );
    }
  }

  return {
    vehicleCount: nearbyVehicles.length,
    scooterCount,
    bikeCount,
    parkingZoneCount,
    availableDockCount
  };
};
