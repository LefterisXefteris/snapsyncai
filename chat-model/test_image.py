"""The model image builds from this directory alone."""

from pathlib import Path


def test_the_model_image_copies_only_files_in_this_directory() -> None:
    root = Path(__file__).resolve().parent
    dockerfile = (root / "Dockerfile").read_text()
    for line in dockerfile.splitlines():
        stripped = line.strip()
        if not stripped.startswith("COPY "):
            continue
        assert "api-py" not in stripped
        sources = stripped.split()[1:-1]
        for source in sources:
            assert (root / source).is_file(), source
