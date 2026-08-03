import paramiko
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
password = sys.argv[1]

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("193.187.96.75", username="root", password=password, timeout=30)

cmds = [
    "cd /opt/personal-assistant-hub && docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml ps -a",
    "systemctl is-enabled docker",
    "systemctl is-active docker",
    "docker inspect --format '{{.Name}} restart={{.HostConfig.RestartPolicy.Name}}' $(docker ps -aq) 2>/dev/null | head -20",
    "ls -la /etc/systemd/system/personal-assistant-hub.service 2>/dev/null || echo NO_SYSTEMD_UNIT",
    "free -h",
    "df -h /",
]
for cmd in cmds:
    print(">", cmd)
    _, o, e = c.exec_command(cmd, timeout=60)
    print(o.read().decode("utf-8", errors="replace"))
    err = e.read().decode("utf-8", errors="replace")
    if err.strip():
        print("ERR", err)
c.close()
