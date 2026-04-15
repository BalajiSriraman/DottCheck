export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type SavedLocation = {
  id: string;
  name: string;
  citySlug: string;
  countryCode: string;
  radiusMeters: number;
  coordinates: Coordinates;
  createdAt: string;
};

export type Vehicle = {
  bike_id: string;
  lat: number;
  lon: number;
  vehicle_type_id?: string;
  is_disabled?: 0 | 1;
  is_reserved?: 0 | 1;
};

export type StationInformation = {
  station_id: string;
  name: string;
  lat: number;
  lon: number;
  capacity?: number;
};

export type StationStatus = {
  station_id: string;
  num_docks_available?: number;
};

export type DottSummary = {
  vehicleCount: number;
  scooterCount: number;
  bikeCount: number;
  parkingZoneCount: number;
  availableDockCount: number;
};
