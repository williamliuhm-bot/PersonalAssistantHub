import json
import ssl
import urllib.request

ctx = ssl.create_default_context()
base = "https://api.persasisthubonline.ru"

payload = json.dumps({"email": "demo@example.com", "password": "password123"}).encode()
req = urllib.request.Request(
    f"{base}/auth/login",
    data=payload,
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
    tokens = json.loads(r.read().decode())
    token = tokens["access_token"]

req = urllib.request.Request(
    f"{base}/auth/me",
    headers={"Authorization": f"Bearer {token}"},
)
with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
    me = json.loads(r.read().decode())
    print("role:", me.get("role"))
    print("subscription:", me.get("subscription_status"))

req = urllib.request.Request(
    f"{base}/auth/users?limit=5",
    headers={"Authorization": f"Bearer {token}"},
)
with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
    users = json.loads(r.read().decode())
    print("users total:", users.get("total"))

with urllib.request.urlopen("https://persasisthubonline.ru/admin/users", timeout=20, context=ctx) as r:
    print("admin page:", r.status)
