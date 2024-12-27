export async function runGetCurrentWeather(location: string, unit: string = 'celsius') {
    // geocoding
    const googleKey = process.env.GOOGLE_GEOCODING_API_KEY;
    if (!googleKey) throw new Error("Missing GOOGLE_GEOCODING_API_KEY");
  
    const encodedLoc = encodeURIComponent(location);
    const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedLoc}&key=${googleKey}`;
    const geoResp = await fetch(geoUrl);
    if (!geoResp.ok) {
      throw new Error(`Geocoding fetch failed: ${geoResp.statusText}`);
    }
    const geoData = await geoResp.json();
    if (geoData.status !== 'OK' || !geoData.results?.length) {
      throw new Error(`Geocoding error: ${geoData.error_message || 'Unknown'}`);
    }
    const lat = geoData.results[0].geometry.location.lat;
    const lon = geoData.results[0].geometry.location.lng;
  
    // openWeather
    const openWeatherKey = process.env.OPENWEATHER_API_KEY;
    if (!openWeatherKey) throw new Error("Missing OPENWEATHER_API_KEY");
  
    const units = unit === 'celsius'
      ? 'metric'
      : unit === 'fahrenheit'
      ? 'imperial'
      : 'standard';
  
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${openWeatherKey}&units=${units}`;
    const wResp = await fetch(weatherUrl);
    if (!wResp.ok) {
      throw new Error(`Weather fetch error: ${wResp.statusText}`);
    }
  
    const wData = await wResp.json();
    return {
      location: wData.name,
      temperature: wData.main?.temp,
      unit,
      description: wData.weather?.[0]?.description,
    };
  }
  