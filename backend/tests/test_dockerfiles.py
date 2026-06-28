from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = REPO_ROOT / "backend"


def _line_index(lines: list[str], needle: str) -> int:
    for index, line in enumerate(lines):
        if needle in line:
            return index
    raise AssertionError(f"Missing line containing: {needle}")


def test_backend_dockerfile_copies_source_before_pip_install_dot():
    lines = (BACKEND_DIR / "Dockerfile").read_text().splitlines()

    copy_source_index = _line_index(lines, "COPY . .")
    pip_install_dot_index = _line_index(lines, "pip install --no-cache-dir .")

    assert copy_source_index < pip_install_dot_index


def test_root_dockerfile_uses_production_langgraph_config():
    dockerfile = (REPO_ROOT / "Dockerfile").read_text()

    assert "COPY backend/ ." in dockerfile
    assert '--config", "langgraph.production.json' in dockerfile
