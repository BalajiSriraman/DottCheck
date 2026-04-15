import { FormEvent, useEffect, useMemo, useState } from 'react';
import './App.css';
import { getCitiesForCountry, getNearbySummary } from './dottApi';
import { logLocationSnapshot, readLocationHistory, readSavedLocations, writeSavedLocations } from './storage';
import type { Coordinates, DottSummary, SavedLocation } from './types';

const DEFAULT_COUNTRY = 'fr';
const DEFAULT_RADIUS_METERS = 700;
const MORNING_HOUR = 8;

const formatCoordinates = (coordinates: Coordinates): string =>
  `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`;

const createLocation = (args: {
  name: string;
  countryCode: string;
  citySlug: string;
  coordinates: Coordinates;
  radiusMeters: number;
}): SavedLocation => ({
  id: crypto.randomUUID(),
  createdAt: new Date().toISOString(),
  ...args
});

function App() {
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY);
  const [citySlug, setCitySlug] = useState('');
  const [cities, setCities] = useState<string[]>([]);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [summary, setSummary] = useState<DottSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Idle');
  const [radiusMeters, setRadiusMeters] = useState(DEFAULT_RADIUS_METERS);
  const [locationName, setLocationName] = useState('Home');
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [selectedSavedLocationId, setSelectedSavedLocationId] = useState('');

  useEffect(() => {
    setSavedLocations(readSavedLocations());
  }, []);

  useEffect(() => {
    const loadCities = async () => {
      try {
        setError(null);
        const fetched = await getCitiesForCountry(countryCode);
        setCities(fetched);
        setCitySlug((current) => current || fetched[0] || '');
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load cities');
      }
    };

    void loadCities();
  }, [countryCode]);

  const requestLocation = async (): Promise<Coordinates> =>
    new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const next: Coordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          setCoordinates(next);
          logLocationSnapshot(next);
          resolve(next);
        },
        (geoError) => reject(new Error(geoError.message)),
        { enableHighAccuracy: true, maximumAge: 300_000, timeout: 10_000 }
      );
    });

  const runCheck = async (fixedCoords?: Coordinates) => {
    if (!citySlug) {
      setError('Choose a city first.');
      return;
    }

    try {
      setStatus('Loading nearby Dott inventory...');
      setError(null);
      const center = fixedCoords ?? coordinates ?? (await requestLocation());
      const nextSummary = await getNearbySummary(citySlug, center, radiusMeters);
      setSummary(nextSummary);
      setStatus(`Updated at ${new Date().toLocaleTimeString()}`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load feed data');
      setStatus('Error');
    }
  };

  const saveLocation = (event: FormEvent) => {
    event.preventDefault();
    if (!coordinates || !citySlug) {
      setError('Get your location and choose a city before saving.');
      return;
    }

    const next = createLocation({
      name: locationName.trim() || 'Saved spot',
      citySlug,
      countryCode,
      coordinates,
      radiusMeters
    });

    const updated = [next, ...savedLocations];
    setSavedLocations(updated);
    writeSavedLocations(updated);
    setSelectedSavedLocationId(next.id);
  };

  const selectedSavedLocation = useMemo(
    () => savedLocations.find((location) => location.id === selectedSavedLocationId) ?? null,
    [savedLocations, selectedSavedLocationId]
  );

  useEffect(() => {
    if (!selectedSavedLocation) {
      return;
    }

    setCountryCode(selectedSavedLocation.countryCode);
    setCitySlug(selectedSavedLocation.citySlug);
    setRadiusMeters(selectedSavedLocation.radiusMeters);
    setCoordinates(selectedSavedLocation.coordinates);
    void runCheck(selectedSavedLocation.coordinates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSavedLocationId]);

  const setupMorningReminder = async () => {
    if (!('Notification' in window)) {
      setError('This browser does not support Notifications.');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setError('Notification permission was not granted.');
      return;
    }

    const now = new Date();
    const nextReminder = new Date(now);
    nextReminder.setHours(MORNING_HOUR, 0, 0, 0);
    if (nextReminder <= now) {
      nextReminder.setDate(nextReminder.getDate() + 1);
    }

    const waitMs = nextReminder.getTime() - now.getTime();
    window.setTimeout(() => {
      const body = summary
        ? `${summary.vehicleCount} total vehicles near ${locationName}.`
        : 'Open DottCheck to refresh availability.';

      new Notification('DottCheck 8:00 reminder', { body });
    }, waitMs);

    setStatus(`Reminder set for ${nextReminder.toLocaleString()}`);
  };

  const locationHistory = readLocationHistory();

  return (
    <main className="page">
      <h1>DottCheck</h1>
      <p className="subtitle">Track nearby Dott bikes/scooters + parking around your saved places.</p>

      <section className="card controls">
        <label>
          Country code
          <input value={countryCode} onChange={(event) => setCountryCode(event.target.value.toLowerCase())} maxLength={2} />
        </label>

        <label>
          City
          <select value={citySlug} onChange={(event) => setCitySlug(event.target.value)}>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </label>

        <label>
          Radius (meters)
          <input
            type="number"
            min={100}
            step={100}
            value={radiusMeters}
            onChange={(event) => setRadiusMeters(Number(event.target.value))}
          />
        </label>

        <div className="buttons">
          <button onClick={() => void requestLocation()}>Use my current location</button>
          <button onClick={() => void runCheck()} className="primary">
            Check nearby vehicles
          </button>
          <button onClick={() => void setupMorningReminder()}>Set 8:00 AM reminder</button>
        </div>
      </section>

      <section className="card">
        <h2>Saved places</h2>
        <form onSubmit={saveLocation} className="save-form">
          <input value={locationName} onChange={(event) => setLocationName(event.target.value)} placeholder="Name (Home, Office...)" />
          <button type="submit">Pin current spot</button>
        </form>

        <select
          value={selectedSavedLocationId}
          onChange={(event) => setSelectedSavedLocationId(event.target.value)}
          disabled={savedLocations.length === 0}
        >
          <option value="">Select saved place</option>
          {savedLocations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name} · {location.citySlug} · {location.radiusMeters}m
            </option>
          ))}
        </select>
      </section>

      <section className="card">
        <h2>Current snapshot</h2>
        <p>Status: {status}</p>
        <p>Coordinates: {coordinates ? formatCoordinates(coordinates) : 'Not captured yet'}</p>
        {summary && (
          <ul>
            <li>Total available vehicles: {summary.vehicleCount}</li>
            <li>Scooters: {summary.scooterCount}</li>
            <li>Bikes: {summary.bikeCount}</li>
            <li>Parking stations nearby: {summary.parkingZoneCount}</li>
            <li>Available docks: {summary.availableDockCount}</li>
          </ul>
        )}
        {error && <p className="error">{error}</p>}
      </section>

      <section className="card">
        <h2>Location log (for your future server)</h2>
        {locationHistory.length === 0 ? (
          <p>No location snapshots yet.</p>
        ) : (
          <ul>
            {locationHistory.slice(0, 5).map((entry) => (
              <li key={entry.at}>
                {new Date(entry.at).toLocaleString()} → {formatCoordinates(entry.coordinates)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="footnote">
        Note: browser reminders require the page to stay open. For true background 8:00 notifications, move this logic to a server cron + push system.
      </p>
    </main>
  );
}

export default App;
