"""Railway must migrate before it serves, or SQLModel columns 500 subscription status."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_railway_boot_runs_alembic_before_uvicorn() -> None:
    for rel in ("Dockerfile", "api-py/Dockerfile"):
        text = (ROOT / rel).read_text()
        cmd = next(line for line in text.splitlines() if line.startswith("CMD "))
        assert "alembic upgrade head" in cmd, rel
        assert "uvicorn" in cmd, rel
        assert cmd.index("alembic upgrade head") < cmd.index("uvicorn"), rel
