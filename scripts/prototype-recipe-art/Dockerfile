# PROTOTYPE, throwaway. Build from the repo root:
#   docker build -f scripts/prototype-recipe-art/Dockerfile -t magpie-art-prototype .
FROM python:3.12-slim
RUN pip install --no-cache-dir numpy pillow "rembg[cpu]==2.0.85"
# Bake the model in so a cold start never downloads it.
RUN python -c "from rembg import new_session; new_session('isnet-general-use')"
COPY scripts/art-matting.py /app/scripts/art-matting.py
COPY scripts/prototype-recipe-art/server.py /app/scripts/prototype-recipe-art/server.py
RUN sed -i 's/"127.0.0.1", 8765/"0.0.0.0", 8765/' /app/scripts/prototype-recipe-art/server.py
CMD ["python", "/app/scripts/prototype-recipe-art/server.py"]
