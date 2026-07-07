import os
import paramiko
import subprocess
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

password = sys.argv[1]
root = Path(__file__).resolve().parents[1]
frontend = root / "frontend"
build_env = os.environ.copy()
for line in (root / "deploy" / "env.production").read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    if key.startswith("VITE_") or key.startswith("RATE_"):
        build_env[key if key.startswith("VITE_") else f"VITE_{key}"] = value

subprocess.run(["npx.cmd", "vite", "build"], cwd=frontend, env=build_env, shell=True, check=True)

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("193.187.96.75", username="root", password=password, timeout=30)
sftp = c.open_sftp()

# upload dist folder
for base, dirs, files in os.walk(frontend / "dist"):
    rel = Path(base).relative_to(frontend / "dist")
    remote_base = f"/opt/personal-assistant-hub/frontend/dist/{rel.as_posix()}" if str(rel) != "." else "/opt/personal-assistant-hub/frontend/dist"
    try:
        sftp.mkdir(remote_base)
    except OSError:
        pass
    for f in files:
        sftp.put(str(Path(base) / f), f"{remote_base}/{f}")

sftp.put(str(root / "deploy" / "Caddyfile"), "/opt/personal-assistant-hub/deploy/Caddyfile")
sftp.put(str(root / "deploy" / "env.production"), "/opt/personal-assistant-hub/.env")
sftp.close()

cmds = [
    "cd /opt/personal-assistant-hub && docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml build frontend",
    "cd /opt/personal-assistant-hub && docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d --force-recreate frontend caddy",
]
for cmd in cmds:
    print(">", cmd)
    _, o, e = c.exec_command(cmd, timeout=600)
    print(o.read().decode("utf-8", errors="replace"))
    err = e.read().decode("utf-8", errors="replace")
    if err.strip():
        print(err)
    if o.channel.recv_exit_status() != 0 and "seed_data" not in cmd:
        break

c.close()
print("patch done")
