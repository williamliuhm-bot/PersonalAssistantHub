import paramiko
import sys
import time

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

password = sys.argv[1]
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("193.187.96.75", username="root", password=password, timeout=30)

cmd = (
    "cd /opt/personal-assistant-hub && "
    "export COMPOSE_PARALLEL_LIMIT=1 DOCKER_BUILDKIT=1 && "
    "bash deploy/deploy.sh > /tmp/pah-deploy.log 2>&1; echo EXIT:$? >> /tmp/pah-deploy.log"
)
print("Starting deploy (foreground on server)...")
_, stdout, stderr = c.exec_command(cmd, timeout=7200)
while not stdout.channel.exit_status_ready():
    time.sleep(30)
    _, o, _ = c.exec_command("tail -5 /tmp/pah-deploy.log 2>/dev/null")
    tail = o.read().decode("utf-8", errors="replace").strip()
    if tail:
        print("--- tail ---")
        print(tail)
code = stdout.channel.recv_exit_status()
print("remote exit", code)
_, o, _ = c.exec_command("tail -40 /tmp/pah-deploy.log")
print(o.read().decode("utf-8", errors="replace"))
_, o, _ = c.exec_command(
    "cd /opt/personal-assistant-hub && docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml ps -a"
)
print(o.read().decode("utf-8", errors="replace"))
c.close()
