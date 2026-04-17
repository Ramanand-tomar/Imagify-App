from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

# In-memory storage: rate limits reset on container restart. Fine for a
# single-replica deployment. slowapi's Redis backend (via the `limits`
# library) doesn't correctly parse `?ssl_cert_reqs=CERT_NONE` from the
# rediss:// URL, so using Upstash for slowapi storage would crash every
# request with `AttributeError: 'RedisError' object has no attribute 'detail'`.
# If you ever scale to multiple replicas and need shared limits, either
# upgrade slowapi to a version that fixes this, or put a plain Redis instance
# (non-TLS) in front of slowapi.
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri="memory://",
    default_limits=[settings.RATE_LIMIT_DEFAULT],
)
