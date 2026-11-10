# Build context is the REPO ROOT: the service runs scripts/art-matting.py,
# the same file the bundled art went through.
#
#   pnpm art:deploy

FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1
# The dependencies scripts/art-matting.py declares for uv.
RUN pip install --no-cache-dir numpy pillow "rembg[cpu]==2.0.85"
# The model goes into the image, so a cold start never downloads it.
RUN python -c "from rembg import new_session; new_session('isnet-general-use')"
WORKDIR /app
COPY scripts/art-matting.py scripts/art-matting.py
COPY apps/art-matting/server.py apps/art-matting/server.py
EXPOSE 8080
CMD ["python", "apps/art-matting/server.py"]
