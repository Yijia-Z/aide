# tool_functions/get_current_weather.py

import os
import urllib.parse
import requests

def execute(**kwargs):
    location = kwargs.get('location')
    unit = kwargs.get('unit', 'celsius')

    if not location:
        raise ValueError("Location is required.")

    # 获取经纬度
    api_key = os.getenv('GOOGLE_GEOCODING_API_KEY')
    if not api_key:
        raise ValueError("GOOGLE_GEOCODING_API_KEY is not set")

    url = f"https://maps.googleapis.com/maps/api/geocode/json?address={urllib.parse.quote(location)}&key={api_key}"
    response = requests.get(url)
    data = response.json()
    if data['status'] != 'OK' or not data['results']:
        raise ValueError(f"Error in geocoding response: {data.get('error_message', 'Unknown error')}")
    result = data['results'][0]
    lat = result['geometry']['location']['lat']
    lon = result['geometry']['location']['lng']

    # 获取天气
    api_key = os.getenv('OPENWEATHER_API_KEY')
    if not api_key:
        raise ValueError("OPENWEATHER_API_KEY is not set")

    units_param = 'metric' if unit == 'celsius' else 'imperial' if unit == 'fahrenheit' else 'standard'
    url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={api_key}&units={units_param}"
    response = requests.get(url)
    data = response.json()
    return {
        'location': data['name'],
        'temperature': data['main']['temp'],
        'unit': unit,
        'description': data['weather'][0]['description'],
    }
