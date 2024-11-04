from pymongo import MongoClient
from pymongo.server_api import ServerApi
from .config import settings

mongo_url = settings.MONGODB_URI
client = MongoClient(mongo_url, server_api=ServerApi('1'))
db = client["threaddata"]
