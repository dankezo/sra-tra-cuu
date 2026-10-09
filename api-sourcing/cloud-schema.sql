CREATE TABLE IF NOT EXISTS apisrc_cloud_cache (
 cache_key TEXT PRIMARY KEY, payload TEXT NOT NULL, fetched_at TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS apisrc_cloud_lease (
 cache_key TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS apisrc_cloud_usage (
 provider TEXT NOT NULL, period TEXT NOT NULL, requests INTEGER NOT NULL, PRIMARY KEY(provider,period));
