"""Fail-closed validation for the approved Production backup source."""
import os
import re
import sys
from urllib.parse import parse_qsl, unquote, urlparse

PRODUCTION_REF = "znnkwjogtvzwfkwnmawp"


def validate_source_db_url(value: str) -> None:
    # Never include the connection string (and therefore its password) in errors.
    message = "SUPABASE_DB_URL must identify the current RaceVora Production project via its direct host or Session Pooler."
    try:
        parsed = urlparse(value)
        user = unquote(parsed.username or "")
        direct = parsed.hostname == f"db.{PRODUCTION_REF}.supabase.co" and user == "postgres"
        pooler = bool(re.fullmatch(r"[a-z0-9-]+\.pooler\.supabase\.com", parsed.hostname or "")) and user == f"postgres.{PRODUCTION_REF}"
        options = parse_qsl(parsed.query, keep_blank_values=True)
        if (parsed.scheme not in ("postgres", "postgresql") or not (direct or pooler)
                or parsed.port not in (None, 5432) or parsed.path != "/postgres"
                or parsed.fragment or not parsed.password
                or any(key != "sslmode" or val not in ("require", "verify-ca", "verify-full") for key, val in options)):
            raise ValueError(message)
    except (ValueError, TypeError):
        raise ValueError(message) from None


if __name__ == "__main__":
    try:
        validate_source_db_url(os.environ.get("SUPABASE_DB_URL", ""))
    except ValueError as error:
        print(error, file=sys.stderr)
        sys.exit(1)
