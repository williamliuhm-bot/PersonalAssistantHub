import paramiko
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("193.187.96.75", username="root", password=sys.argv[1], timeout=30)

cmds = [
    "cd /opt/personal-assistant-hub && docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml ps -a",
    "docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'",
    "ss -tlnp | head -20",
]
for cmd in cmds:
    print(">", cmd)
    _, o, e = c.exec_command(cmd, timeout=120)
    print(o.read().decode("utf-8", errors="replace"))
    err = e.read().decode("utf-8", errors="replace")
    if err.strip():
        print("ERR", err)
c.close()
