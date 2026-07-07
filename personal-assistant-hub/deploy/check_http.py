import json
import ssl
import urllib.request

ctx = ssl.create_default_context()

checks = [
    ("https://persasisthubonline.ru/", "GET"),
    ("https://www.persasisthubonline.ru/", "GET"),
    ("https://api.persasisthubonline.ru/health", "GET"),
    ("http://193.187.96.75/", "GET"),
]

for url, method in checks:
    try:
        req = urllib.request.Request(url, method=method)
        with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
            print(url, r.status, r.geturl())
    except Exception as e:
        print(url, "ERR", e)

payload = json.dumps({"email": "demo@example.com", "password": "password123"}).encode()
req = urllib.request.Request(
    "https://api.persasisthubonline.ru/auth/login",
    data=payload,
    headers={"Content-Type": "application/json"},
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
        body = json.loads(r.read().decode())
        print("login", "ok" if body.get("access_token") else body)
except Exception as e:
    print("login ERR", e)
