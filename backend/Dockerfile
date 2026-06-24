FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpcre2-dev \
    libssl-dev \
    gcc \
    libc6-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirement.txt .

RUN pip install --no-cache-dir --force-reinstall uwsgi
RUN pip install --no-cache-dir -r requirement.txt

COPY . .

ENV FLASK_APP=flaskr/index.py

EXPOSE 5000

CMD ["uwsgi", "--ini", "uwsgi.ini"]
