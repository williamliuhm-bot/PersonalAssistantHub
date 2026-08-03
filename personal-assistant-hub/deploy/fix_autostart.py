import paramiko
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
password = sys.argv[1]
root = Path(__file__).resolve().parents[1]

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("193.187.96.75", username="root", password=password, timeout=30)
sftp = c.open_sftp()

for local, remote in [
    (root / "docker-compose.yml", "/opt/personal-assistant-hub/docker-compose.yml"),
    (root / "deploy" / "docker-compose.prod.yml", "/opt/personal-assistant-hub/deploy/docker-compose.prod.yml"),
    (root / "deploy" / "personal-assistant-hub.service", "/etc/systemd/system/personal-assistant-hub.service"),
]:
    print("upload", remote)
    sftp.put(str(local), remote)
sftp.close()

cmds = [
    # ensure swap exists (helps after reboot on 1GB RAM)
    "test -f /swapfile || (fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile)",
    "grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab",
    "swapon --show || true",
    # recreate containers so restart=always applies to postgres/redis
    "cd /opt/personal-assistant-hub && docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d",
    "systemctl daemon-reload",
    "systemctl enable personal-assistant-hub.service",
    "systemctl enable docker",
    "sleep 15",
    "cd /opt/personal-assistant-hub && docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml ps -a",
    "docker inspect --format '{{.Name}} restart={{.HostConfig.RestartPolicy.Name}}' $(docker ps -aq)",
    "systemctl is-enabled personal-assistant-hub.service",
    "systemctl is-enabled docker",
]

for cmd in cmds:
    print(">", cmd)
    _, o, e = c.exec_command(cmd, timeout=300)
    out = o.read().decode("utf-8", errors="replace")
    err = e.read().decode("utf-8", errors="replace")
    code = o.channel.recv_exit_status()
    if out.strip():
        print(out.rstrip())
    if err.strip():
        print(err.rstrip())
    if code != 0:
        print("exit", code)

c.close()
print("done")
