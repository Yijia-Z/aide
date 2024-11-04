# backend/services/tool_service.py

import json
import aiohttp
from typing import Dict, Any
from backend.core.config import settings
import logging

logger = logging.getLogger(__name__)

class ToolService:
    def __init__(self):
        self.google_api_key = settings.GOOGLE_GEOCODING_API_KEY
        self.openweather_api_key = settings.OPENWEATHER_API_KEY
        if not self.google_api_key:
            logger.warning("GOOGLE_GEOCODING_API_KEY 未设置")
        if not self.openweather_api_key:
            logger.warning("OPENWEATHER_API_KEY 未设置")
        self.session = aiohttp.ClientSession()

    async def close(self):
        await self.session.close()

    async def handle_tool_call(self, tool_call: Dict[str, Any]) -> Dict[str, Any]:
        try:
            tool_name = tool_call['function']['name']
            arguments_string = tool_call['function']['arguments']
            logger.info(f"Handling tool call: {tool_name} with arguments: {arguments_string}")

            if tool_name == "get_current_weather":
                args = json.loads(arguments_string)
                result = await self.get_current_weather(args)
                return result
            else:
                raise ValueError(f"未知的工具: {tool_name}")
        except Exception as e:
            logger.error(f"Error in handle_tool_call: {str(e)}")
            raise e

    async def get_current_weather(self, args: Dict[str, Any]) -> Dict[str, Any]:
        location = args.get('location')
        unit = args.get('unit', 'celsius')
        if not location:
            raise ValueError("需要提供 location 参数")
        coordinates = await self.get_coordinates(location)
        lat = coordinates['lat']
        lon = coordinates['lon']

        if not self.openweather_api_key:
            raise ValueError("OPENWEATHER_API_KEY 未设置")

        units_param = {
            'celsius': 'metric',
            'fahrenheit': 'imperial',
        }.get(unit, 'standard')

        url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={self.openweather_api_key}&units={units_param}"
        try:
            async with self.session.get(url) as response:
                if response.status != 200:
                    error_text = await response.text()
                    logger.error(f"Error fetching weather data: {response.status} {error_text}")
                    raise ValueError(f"无法获取天气数据: {error_text}")
                data = await response.json()
                result = {
                    'location': data['name'],
                    'temperature': data['main']['temp'],
                    'unit': unit,
                    'description': data['weather'][0]['description'],
                }
                logger.info(f"Weather data: {result}")
                return result
        except Exception as e:
            logger.error(f"Error in get_current_weather: {str(e)}")
            raise e

    async def get_coordinates(self, location: str) -> Dict[str, float]:
        if not self.google_api_key:
            raise ValueError("GOOGLE_GEOCODING_API_KEY 未设置")
        encoded_location = location.replace(" ", "+")
        url = f"https://maps.googleapis.com/maps/api/geocode/json?address={encoded_location}&key={self.google_api_key}"
        try:
            async with self.session.get(url) as response:
                if response.status != 200:
                    error_text = await response.text()
                    logger.error(f"Error fetching coordinates: {response.status} {error_text}")
                    raise ValueError(f"无法从 Google Geocoding API 获取坐标: {error_text}")
                data = await response.json()
                if data['status'] != "OK" or not data['results']:
                    error_message = data.get('error_message', 'No results found')
                    logger.error(f"Geocoding API error: {data['status']} - {error_message}")
                    raise ValueError(f"未找到该地址: {error_message}")
                result = data['results'][0]
                location = result['geometry']['location']
                coordinates = {"lat": location['lat'], "lon": location['lng']}
                logger.info(f"Coordinates for {location}: {coordinates}")
                return coordinates
        except Exception as e:
            logger.error(f"Error in get_coordinates: {str(e)}")
            raise e
