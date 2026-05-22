let currentLocation = null;
let currentRoute = null;
let history = [];
let deferredPrompt = null;
const routingApiUrl = 'https://routing.openstreetmap.de/routed-bike/route/v1/driving';
const averageSpeed = 12;
// Converts the user's target riding time into an initial straight-line distance estimate.
const routeFactor = 1.3;
// Keeps the online validation responsive while still allowing a few correction passes.
const maxValidationAttempts = 4;
const routingRequestTimeoutMs = 8000;

const directions = {
  'Norden': 0,
  'Osten': 90,
  'Süden': 180,
  'Westen': 270
};

// Service Worker registrieren (relativer Pfad, damit es auch in Unterverzeichnissen wie GitHub Pages funktioniert)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.log('Service Worker Registrierung fehlgeschlagen:', err);
    });
  });
}

// PWA Install Handler
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('installBanner').classList.remove('hidden');
});

function installApp() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        document.getElementById('installBanner').classList.add('hidden');
      }
      deferredPrompt = null;
    });
  }
}

// Standort ermitteln
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      currentLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
    },
    (error) => {
      console.log('Standort konnte nicht ermittelt werden:', error);
      currentLocation = { lat: 47.3769, lng: 8.5417 };
    }
  );
} else {
  currentLocation = { lat: 47.3769, lng: 8.5417 };
}

// Verlauf aus localStorage laden
const savedHistory = localStorage.getItem('bikeHistory');
if (savedHistory) {
  history = JSON.parse(savedHistory);
  if (history.length > 0) {
    displayHistory();
  }
}

function getRandomDirection() {
  const dirs = Object.keys(directions);
  return dirs[Math.floor(Math.random() * dirs.length)];
}

function calculateDestination(start, bearing, distanceKm) {
  const R = 6371;
  const lat1 = start.lat * Math.PI / 180;
  const lng1 = start.lng * Math.PI / 180;
  const brng = bearing * Math.PI / 180;
  const d = distanceKm;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d / R) +
    Math.cos(lat1) * Math.sin(d / R) * Math.cos(brng)
  );

  const lng2 = lng1 + Math.atan2(
    Math.sin(brng) * Math.sin(d / R) * Math.cos(lat1),
    Math.cos(d / R) - Math.sin(lat1) * Math.sin(lat2)
  );

  return {
    lat: lat2 * 180 / Math.PI,
    lng: lng2 * 180 / Math.PI
  };
}

function getDurationToleranceHours(hours) {
  return Math.max(0.25, hours * 0.15);
}

function isDurationWithinTolerance(actualHours, targetHours) {
  return Math.abs(actualHours - targetHours) <= getDurationToleranceHours(targetHours);
}

function setGenerateButtonLoading(isLoading) {
  const button = document.getElementById('generateBtn');
  button.disabled = isLoading;
  button.textContent = isLoading ? '⏳ Route wird geprüft...' : '🧭 Route generieren';
}

async function fetchRouteEstimate(start, end) {
  // The routed-bike service still uses the OSRM "/driving" path for bike routes.
  // This API expects coordinates in "lng,lat" order.
  const url = `${routingApiUrl}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=false&alternatives=false&steps=false`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), routingRequestTimeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Routing API Fehler: ${response.status}`);
    }

    const data = await response.json();
    const route = data.routes && data.routes[0];

    if (!route || typeof route.duration !== 'number' || typeof route.distance !== 'number') {
      throw new Error('Keine Routing-Daten verfügbar');
    }

    return {
      hours: route.duration / 3600,
      distanceKm: route.distance / 1000
    };
  } catch (error) {
    console.log('Fahrzeit-Prüfung fehlgeschlagen:', error);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function generateRoute() {
  if (!currentLocation) {
    alert('Standort wird noch ermittelt...');
    return;
  }

  const directionSelect = document.getElementById('direction');
  const hoursInput = document.getElementById('hours');
  const directionValue = directionSelect.value;
  const hoursRaw = hoursInput.value.trim();
  const hours = Number(hoursRaw);

  if (hoursRaw === '' || !Number.isInteger(hours) || hours < 1 || hours > 10) {
    alert('Bitte eine gültige Dauer zwischen 1 und 10 Stunden eingeben.');
    return;
  }

  const selectedDirection = directionValue === 'random' ? getRandomDirection() : directionValue;
  const bearing = directions[selectedDirection];
  let distanceKm = (hours * averageSpeed) / routeFactor;
  let destination = calculateDestination(currentLocation, bearing, distanceKm);
  let routeEstimate = null;
  let validationStatus = 'warning';

  setGenerateButtonLoading(true);

  try {
    for (let retryAttempt = 0; retryAttempt < maxValidationAttempts; retryAttempt++) {
      destination = calculateDestination(currentLocation, bearing, distanceKm);
      routeEstimate = await fetchRouteEstimate(currentLocation, destination);

      if (!routeEstimate) {
        validationStatus = 'unknown';
        break;
      }

      if (isDurationWithinTolerance(routeEstimate.hours, hours)) {
        validationStatus = 'ok';
        break;
      }

      if (routeEstimate.hours <= 0) {
        validationStatus = 'unknown';
        break;
      }

      distanceKm *= hours / routeEstimate.hours;
    }

    const durationDifferenceMinutes = routeEstimate
      ? Math.round((routeEstimate.hours - hours) * 60)
      : null;

    currentRoute = {
      start: currentLocation,
      end: destination,
      direction: selectedDirection,
      hours: hours,
      distance: distanceKm,
      estimatedDurationHours: routeEstimate ? routeEstimate.hours : null,
      estimatedDistanceKm: routeEstimate ? routeEstimate.distanceKm : null,
      durationDifferenceMinutes,
      validationStatus,
      timestamp: new Date().toLocaleString('de-DE')
    };

    displayRoute();
    addToHistory(currentRoute);
  } finally {
    setGenerateButtonLoading(false);
  }
}

function displayRoute() {
  document.getElementById('routeCard').classList.remove('hidden');
  document.getElementById('statDirection').textContent = currentRoute.direction;
  document.getElementById('statHours').textContent = currentRoute.hours + 'h';
  document.getElementById('statDistance').textContent = currentRoute.distance.toFixed(1) + ' km';

  const routeCheck = document.getElementById('routeCheck');
  routeCheck.className = `route-check ${currentRoute.validationStatus || 'unknown'}`;

  if (currentRoute.validationStatus === 'ok' && currentRoute.estimatedDurationHours !== null) {
    routeCheck.textContent = `✅ Geprüft: Routing-Schätzung ${currentRoute.estimatedDurationHours.toFixed(1)} h`;
  } else if (currentRoute.validationStatus === 'warning' && currentRoute.estimatedDurationHours !== null) {
    const prefix = currentRoute.durationDifferenceMinutes > 0 ? '+' : '';
    routeCheck.textContent = `⚠️ Abweichung erkannt: Routing-Schätzung ${currentRoute.estimatedDurationHours.toFixed(1)} h (${prefix}${currentRoute.durationDifferenceMinutes} Min.)`;
  } else {
    routeCheck.textContent = 'ℹ️ Fahrzeit konnte nicht online geprüft werden. Distanz bleibt eine Näherung.';
  }

  document.getElementById('routeDetails').innerHTML = `
    <strong>Start:</strong> ${currentRoute.start.lat.toFixed(5)}, ${currentRoute.start.lng.toFixed(5)}<br>
    <strong>Ziel:</strong> ${currentRoute.end.lat.toFixed(5)}, ${currentRoute.end.lng.toFixed(5)}<br>
    <strong>Routing-Distanz:</strong> ${currentRoute.estimatedDistanceKm !== null ? `${currentRoute.estimatedDistanceKm.toFixed(1)} km` : 'nicht verfügbar'}
  `;
}

function addToHistory(route) {
  history.unshift(route);
  if (history.length > 10) history = history.slice(0, 10);
  localStorage.setItem('bikeHistory', JSON.stringify(history));
  displayHistory();
}

function displayHistory() {
  const historyCard = document.getElementById('historyCard');
  const historyList = document.getElementById('historyList');

  if (history.length === 0) {
    historyCard.classList.add('hidden');
    return;
  }

  historyCard.classList.remove('hidden');
  historyList.innerHTML = history.map(item => `
    <div class="history-item">
      <div class="history-info">
        ${item.direction} • ${item.hours}h • ${item.distance.toFixed(1)} km
      </div>
      <div class="history-time">${item.timestamp}</div>
    </div>
  `).join('');
}

function openInMaps() {
  if (currentRoute) {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${currentRoute.start.lat},${currentRoute.start.lng}&destination=${currentRoute.end.lat},${currentRoute.end.lng}&travelmode=bicycling`;
    window.open(url, '_blank');
  }
}

async function resetApp() {
  if (!confirm('App zurücksetzen? Verlauf und Cache werden gelöscht.')) return;

  localStorage.clear();

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(reg => reg.unregister()));
  }

  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => caches.delete(key)));
  }

  location.reload();
}
