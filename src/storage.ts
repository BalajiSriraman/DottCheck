import type { Coordinates, SavedLocation } from './types';

const SAVED_LOCATIONS_KEY = 'dottcheck.savedLocations.v1';
const LOCATION_LOG_KEY = 'dottcheck.locationLog.v1';

export const readSavedLocations = (): SavedLocation[] => {
  try {
    const raw = localStorage.getItem(SAVED_LOCATIONS_KEY);
    return raw ? (JSON.parse(raw) as SavedLocation[]) : [];
  } catch {
    return [];
  }
};

export const writeSavedLocations = (locations: SavedLocation[]): void => {
  localStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(locations));
};

export const logLocationSnapshot = (coordinates: Coordinates): void => {
  const record = {
    at: new Date().toISOString(),
    coordinates
  };

  const history = readLocationHistory();
  const bounded = [record, ...history].slice(0, 30);
  localStorage.setItem(LOCATION_LOG_KEY, JSON.stringify(bounded));
};

export const readLocationHistory = (): Array<{ at: string; coordinates: Coordinates }> => {
  try {
    const raw = localStorage.getItem(LOCATION_LOG_KEY);
    return raw ? (JSON.parse(raw) as Array<{ at: string; coordinates: Coordinates }>) : [];
  } catch {
    return [];
  }
};
