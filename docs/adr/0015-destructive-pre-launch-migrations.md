# Pre-launch schema changes may freely drop and recreate data

The migration that introduced hashed API keys deletes all existing `Environment` rows before altering columns, rather than writing a backfill for the old plaintext `apiKey` values. This is acceptable because the platform has no production deployment yet — there are no real users or data to preserve, so every migration up to launch can prioritize a clean schema over a safe backfill path. This stops being true the moment the platform has its first production deployment; from that point on, migrations must preserve existing data.
