// ---- Sabitler ----
const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const REVERSE_URL = "https://geocoding-api.open-meteo.com/v1/reverse";

// Open-Meteo "weathercode" değerlerini emoji + açıklamaya çeviriyoruz
const WEATHER_CODES = {
  0: { desc: "Açık hava", icon: "☀️" },
  1: { desc: "Genelde açık", icon: "🌤️" },
  2: { desc: "Parçalı bulutlu", icon: "⛅" },
  3: { desc: "Kapalı", icon: "☁️" },
  45: { desc: "Sisli", icon: "🌫️" },
  48: { desc: "Kırağı sisi", icon: "🌫️" },
  51: { desc: "Hafif çisenti", icon: "🌦️" },
  53: { desc: "Çisenti", icon: "🌦️" },
  55: { desc: "Yoğun çisenti", icon: "🌧️" },
  61: { desc: "Hafif yağmurlu", icon: "🌧️" },
  63: { desc: "Yağmurlu", icon: "🌧️" },
  65: { desc: "Şiddetli yağmur", icon: "🌧️" },
  71: { desc: "Hafif kar yağışlı", icon: "🌨️" },
  73: { desc: "Kar yağışlı", icon: "🌨️" },
  75: { desc: "Yoğun kar yağışlı", icon: "❄️" },
  77: { desc: "Kar taneleri", icon: "❄️" },
  80: { desc: "Hafif sağanak", icon: "🌦️" },
  81: { desc: "Sağanak yağışlı", icon: "🌧️" },
  82: { desc: "Şiddetli sağanak", icon: "⛈️" },
  85: { desc: "Hafif kar sağanağı", icon: "🌨️" },
  86: { desc: "Kar sağanağı", icon: "🌨️" },
  95: { desc: "Gök gürültülü fırtına", icon: "⛈️" },
  96: { desc: "Dolu ile fırtına", icon: "⛈️" },
  99: { desc: "Şiddetli dolu fırtınası", icon: "⛈️" },
};

const DAY_NAMES = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
const MONTH_NAMES = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

// ---- DOM referansları ----
const form = document.getElementById("search-form");
const input = document.getElementById("city-input");
const suggestionsEl = document.getElementById("suggestions");
const statusEl = document.getElementById("status");
const locateBtn = document.getElementById("locate-btn");

const currentWeatherEl = document.getElementById("current-weather");
const cityNameEl = document.getElementById("city-name");
const currentDateEl = document.getElementById("current-date");
const weatherIconEl = document.getElementById("weather-icon");
const currentTempEl = document.getElementById("current-temp");
const weatherDescEl = document.getElementById("weather-desc");
const feelsLikeEl = document.getElementById("feels-like");
const humidityEl = document.getElementById("humidity");
const windEl = document.getElementById("wind");
const uvIndexEl = document.getElementById("uv-index");

const forecastEl = document.getElementById("forecast");
const forecastListEl = document.getElementById("forecast-list");

let debounceTimer = null;

// ---- Sıcaklık birimi durumu ----
// weatherState: en son çekilen API verisini Celsius olarak saklar,
// böylece birim değiştirildiğinde yeniden API çağrısı yapmadan render edebiliriz.
let currentUnit = "C"; // "C" | "F"
let weatherState = null; // { current, daily, label }

const unitToggle = document.getElementById("unit-toggle");

function celsiusToFahrenheit(c) {
  return c * 9 / 5 + 32;
}

function formatTemp(celsiusValue, decimals = 0) {
  const value = currentUnit === "C" ? celsiusValue : celsiusToFahrenheit(celsiusValue);
  return `${value.toFixed(decimals)}°${currentUnit}`;
}

// ---- Yardımcı fonksiyonlar ----
function getWeatherInfo(code) {
  return WEATHER_CODES[code] || { desc: "Bilinmiyor", icon: "❓" };
}

function formatDate(date) {
  const day = DAY_NAMES[date.getDay()];
  const dayNum = date.getDate();
  const month = MONTH_NAMES[date.getMonth()];
  return `${day}, ${dayNum} ${month}`;
}

function setStatus(message, showLocate = true) {
  statusEl.innerHTML = "";
  const p = document.createElement("p");
  p.textContent = message;
  statusEl.appendChild(p);
  if (showLocate) {
    statusEl.appendChild(locateBtn);
  }
  statusEl.classList.remove("hidden");
  currentWeatherEl.classList.add("hidden");
  forecastEl.classList.add("hidden");
}

function showLoading() {
  setStatus("Yükleniyor...", false);
}

// ---- Şehir arama / öneri listesi ----
async function fetchSuggestions(query) {
  if (!query || query.trim().length < 2) {
    suggestionsEl.classList.add("hidden");
    suggestionsEl.innerHTML = "";
    return;
  }
  try {
    const url = `${GEOCODE_URL}?name=${encodeURIComponent(query)}&count=5&language=tr&format=json`;
    const res = await fetch(url);
    const data = await res.json();
    renderSuggestions(data.results || []);
  } catch (err) {
    console.error("Öneri alınamadı:", err);
  }
}

function renderSuggestions(results) {
  suggestionsEl.innerHTML = "";
  if (!results.length) {
    suggestionsEl.classList.add("hidden");
    return;
  }
  results.forEach((place) => {
    const li = document.createElement("li");
    const parts = [place.name, place.admin1, place.country].filter(Boolean);
    li.textContent = parts.join(", ");
    li.addEventListener("click", () => {
      suggestionsEl.classList.add("hidden");
      input.value = place.name;
      loadWeather(place.latitude, place.longitude, parts.join(", "));
    });
    suggestionsEl.appendChild(li);
  });
  suggestionsEl.classList.remove("hidden");
}

async function searchCity(query) {
  showLoading();
  try {
    const url = `${GEOCODE_URL}?name=${encodeURIComponent(query)}&count=1&language=tr&format=json`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.results || !data.results.length) {
      setStatus(`"${query}" için sonuç bulunamadı. Başka bir şehir deneyin.`);
      return;
    }
    const place = data.results[0];
    const parts = [place.name, place.admin1, place.country].filter(Boolean);
    loadWeather(place.latitude, place.longitude, parts.join(", "));
  } catch (err) {
    console.error(err);
    setStatus("Bir hata oluştu. Lütfen tekrar deneyin.");
  }
}

// ---- Konumdan hava durumu ----
function useMyLocation() {
  if (!navigator.geolocation) {
    setStatus("Tarayıcınız konum özelliğini desteklemiyor.");
    return;
  }
  showLoading();
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      let label = "Konumunuz";
      try {
        const res = await fetch(
          `${REVERSE_URL}?latitude=${latitude}&longitude=${longitude}&language=tr&format=json`
        );
        const data = await res.json();
        if (data.results && data.results.length) {
          const place = data.results[0];
          label = [place.name, place.country].filter(Boolean).join(", ");
        }
      } catch (err) {
        console.warn("Ters coğrafi kodlama başarısız oldu, varsayılan etiket kullanılıyor.");
      }
      loadWeather(latitude, longitude, label);
    },
    () => {
      setStatus("Konum izni alınamadı. Lütfen şehir aratın.");
    }
  );
}

// ---- Hava durumu verisini çekme ve gösterme ----
async function loadWeather(lat, lon, label) {
  showLoading();
  try {
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,uv_index_max",
      timezone: "auto",
      forecast_days: "6",
    });
    const res = await fetch(`${FORECAST_URL}?${params.toString()}`);
    if (!res.ok) throw new Error("Hava durumu verisi alınamadı");
    const data = await res.json();
    renderWeather(data, label);
  } catch (err) {
    console.error(err);
    setStatus("Hava durumu verisi alınamadı. Lütfen tekrar deneyin.");
  }
}

function renderWeather(data, label) {
  statusEl.classList.add("hidden");
  currentWeatherEl.classList.remove("hidden");
  forecastEl.classList.remove("hidden");

  // Sonraki render çağrılarında (birim değişince) tekrar kullanmak için sakla
  weatherState = { data, label };

  const current = data.current;
  const weatherInfo = getWeatherInfo(current.weather_code);

  cityNameEl.textContent = label;
  currentDateEl.textContent = formatDate(new Date());
  weatherIconEl.textContent = weatherInfo.icon;
  currentTempEl.textContent = formatTemp(current.temperature_2m);
  weatherDescEl.textContent = weatherInfo.desc;
  feelsLikeEl.textContent = formatTemp(current.apparent_temperature);
  humidityEl.textContent = `${current.relative_humidity_2m}%`;
  windEl.textContent = `${Math.round(current.wind_speed_10m)} km/sa`;

  // Bugünün UV endeksi (daily dizisindeki ilk eleman)
  const todayUv = data.daily.uv_index_max?.[0];
  uvIndexEl.textContent = todayUv !== undefined ? todayUv.toFixed(1) : "-";

  renderForecast(data.daily);

  // Arka plan animasyonunu güncelle (weather-effects.js)
  if (typeof setWeatherAnimation === "function") {
    const isDay = current.is_day === undefined ? true : Boolean(current.is_day);
    setWeatherAnimation(current.weather_code, isDay);
  }
}

function renderForecast(daily) {
  forecastListEl.innerHTML = "";
  const days = daily.time;

  // İlk gün "bugün" olduğu için 1'den başlayıp 5 gün gösteriyoruz
  for (let i = 1; i < days.length && i <= 5; i++) {
    const date = new Date(days[i]);
    const weatherInfo = getWeatherInfo(daily.weather_code[i]);
    const max = formatTemp(daily.temperature_2m_max[i]);
    const min = formatTemp(daily.temperature_2m_min[i]);

    const dayEl = document.createElement("div");
    dayEl.className = "forecast-day";
    dayEl.innerHTML = `
      <span class="forecast-day__name">${DAY_NAMES[date.getDay()]}</span>
      <span class="forecast-day__icon">${weatherInfo.icon}</span>
      <span class="forecast-day__temp">${max} <span>${min}</span></span>
    `;
    forecastListEl.appendChild(dayEl);
  }
}

// ---- Birim değiştirme (°C / °F) ----
function setUnit(unit) {
  if (unit === currentUnit) return;
  currentUnit = unit;

  unitToggle.querySelectorAll(".unit-toggle__option").forEach((el) => {
    el.classList.toggle("unit-toggle__option--active", el.dataset.unit === unit);
  });

  // Zaten yüklü bir hava durumu verisi varsa, API'ye tekrar gitmeden yeniden çiz
  if (weatherState) {
    renderWeather(weatherState.data, weatherState.label);
  }
}

unitToggle.addEventListener("click", () => {
  setUnit(currentUnit === "C" ? "F" : "C");
});

// ---- Olay dinleyicileri ----
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const query = input.value.trim();
  if (query) {
    suggestionsEl.classList.add("hidden");
    searchCity(query);
  }
});

input.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => fetchSuggestions(input.value), 350);
});

document.addEventListener("click", (e) => {
  if (!suggestionsEl.contains(e.target) && e.target !== input) {
    suggestionsEl.classList.add("hidden");
  }
});

locateBtn.addEventListener("click", useMyLocation);

// Sayfa yüklendiğinde başlangıç durumu (statik olarak HTML'de zaten var,
// bu satır sadece locate butonunun dinleyiciye bağlı kalmasını garanti eder)