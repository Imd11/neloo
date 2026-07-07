import os
import sys

from fastapi import FastAPI, Request, Response
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.api.ratelimit import _key_fn, limiter


def _app():
    app = FastAPI()
    app.state.limiter = limiter

    from slowapi import _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded

    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    @app.get("/ping")
    @limiter.limit("5/minute")
    def ping(request: Request, response: Response):
        return {"ok": True}

    return app


def test_key_fn_uses_remote_addr():
    class R:
        client = type("C", (), {"host": "1.2.3.4"})()
        state = type("S", (), {})()

    assert _key_fn(R()) == "1.2.3.4"


def test_limit_returns_429_after_threshold():
    client = TestClient(_app())
    codes = [client.get("/ping").status_code for _ in range(7)]
    assert 200 in codes and codes[-1] == 429
