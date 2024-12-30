// lib/db/mongo.ts
import { MongoClient, Db } from 'mongodb';

let uri = process.env.MONGODB_URI as string; 
let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (!uri) {
  throw new Error("Please add your Mongo URI to .env");
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

// In dev mode, we store the connection in a global variable 
// to avoid creating multiple connections on Hot Reload.
if (!global._mongoClientPromise) {
  client = new MongoClient(uri);
  global._mongoClientPromise = client.connect();
}
clientPromise = global._mongoClientPromise;

// a quick helper
export async function getDB(): Promise<Db> {
  const _client = await clientPromise;
  return _client.db("threaddata");  // 相当于 clientdb["threaddata"]
}
