FROM python:3.11-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libc6-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirement.txt .
RUN pip install --no-cache-dir -r requirement.txt

COPY . .

ENV FLASK_APP=flaskr/index.py
ENV FLASK_ENV=production

EXPOSE 5000

CMD ["uwsgi", "--ini", "uwsgi.ini"]
