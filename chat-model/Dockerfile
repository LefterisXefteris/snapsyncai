# Build context is this directory. The API image at the repo root copies
# api-py/, and that path is not in this context.
FROM python:3.12-slim-bookworm

WORKDIR /srv

ENV PYTHONUNBUFFERED=1

COPY server.py turn.py ./

CMD ["python", "server.py"]
