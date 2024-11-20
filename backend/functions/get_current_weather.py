# backend/function/get_current_weather.py

import os
import requests
import urllib.parse
from typing import Dict
import logging

# 日志设置
logger = logging.getLogger(__name__)

def get_coordinates(location: str) -> (float, float):
    """
    使用 Google 地理编码 API 获取给定位置的经纬度。
    """
    api_key = os.getenv('GOOGLE_GEOCODING_API_KEY')
    if not api_key:
        raise ValueError("GOOGLE_GEOCODING_API_KEY is not set")

    url = f"https://maps.googleapis.com/maps/api/geocode/json?address={urllib.parse.quote(location)}&key={api_key}"
    response = requests.get(url)
    if not response.ok:
        raise ValueError(f"Error fetching coordinates: {response.status_code} {response.text}")
    data = response.json()
    if data['status'] != 'OK' or not data['results']:
        raise ValueError(f"Error in geocoding response: {data.get('error_message', 'Unknown error')}")
    
    result = data['results'][0]
    lat = result['geometry']['location']['lat']
    lon = result['geometry']['location']['lng']
    return lat, lon

def run(location: str, unit: str = 'celsius') -> Dict:
    """
    使用 OpenWeatherMap API 获取当前天气。
    """
    lat, lon = get_coordinates(location)
    api_key = os.getenv('OPENWEATHER_API_KEY')
    if not api_key:
        raise ValueError("OPENWEATHER_API_KEY is not set")

    units_param = 'metric' if unit == 'celsius' else 'imperial' if unit == 'fahrenheit' else 'standard'
    url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={api_key}&units={units_param}"
    
    response = requests.get(url)
    if not response.ok:
        raise ValueError(f"Error fetching weather data: {response.status_code} {response.text}")
    
    data = response.json()
    return {
        "location": data['name'],
        "temperature": data['main']['temp'],
        "unit": unit,
        "description": data['weather'][0]['description'],
    }
