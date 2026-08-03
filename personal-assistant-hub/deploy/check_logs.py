import paramiko
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("193.187.96.75", username="root", password=sys.argv[1], timeout=30)

cmds = [
    "docker logs --tail 40 personal-assistant-hub-finance-service-1 2>&1",
    "docker logs --tail 40 personal-assistant-hub-tasks-service-1 2>&1",
    "docker logs --tail 40 personal-assistant-hub-notification-service-1 2>&1",
    "docker logs --tail 20 personal-assistant-hub-auth-service-1 2>&1",
    "cd /opt/personal-assistant-hub && docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml restart finance-service tasks-service notification-service",
    "sleep 20",
    "cd /opt/personal-assistant-hub && docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml ps -a",
]
for cmd in cmds:
    print(">", cmd[:100])
    _, o, e = c.exec_command(cmd, timeout=120)
    print(o.read().decode("utf-8", errors="replace")[-2500:])
    err = e.read().decode("utf-8", errors="replace")
    if err.strip():
        print(err[-800:])
c.close()
