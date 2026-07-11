import json
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]


def load_config(name: str) -> dict:
    return json.loads((BACKEND_DIR / name).read_text())


def test_default_langgraph_config_has_no_postgres_requirement():
    config = load_config("langgraph.json")

    assert "checkpointer" not in config
    assert "store" not in config
    assert config["env"] == ".env"
    assert "data_analyst" in config["graphs"]


def test_production_langgraph_config_requires_database_url():
    config = load_config("langgraph.production.json")

    assert config["checkpointer"] == {
        "type": "postgres",
        "uri": "${DATABASE_URL}",
    }
    assert config["store"] == {
        "type": "postgres",
        "uri": "${DATABASE_URL}",
    }
    assert config["env"] == ".env"
    assert config["graphs"] == load_config("langgraph.json")["graphs"]
