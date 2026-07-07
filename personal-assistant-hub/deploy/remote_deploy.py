#!/usr/bin/env python3
"""One-shot deploy to production server via SSH/SFTP."""
from __future__ import annotations

import os
import subprocess
import sys
import tarfile
import time
from pathlib import Path

import paramiko

HOST = "193.187.96.75"
USER = "root"
PASSWORD = os.environ.get("DEPLOY_ROOT_PASSWORD", "")
REMOTE_DIR = "/opt/personal-assistant-hub"
LOCAL_ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = LOCAL_ROOT.parent / "pah-deploy.tar.gz"
EXCLUDE_DIRS = {
    "node_modules",
    "__pycache__",
    ".git",
    ".venv",
    "dist",
    "build",
    ".pytest_cache",
}


def log(msg: str) -> None:
    sys.stdout.buffer.write((msg + "\n").encode("utf-8", errors="replace"))
    sys.stdout.buffer.flush()


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 3600) -> int:
    log(f"$ {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        log(out.rstrip())
    if err.strip():
        log(err.rstrip())
    if code != 0:
        log(f"exit {code}")
    return code


def build_frontend_locally() -> None:
    env = os.environ.copy()
    env_file = LOCAL_ROOT / "deploy" / "env.production"
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env.setdefault(key, value)

    frontend = LOCAL_ROOT / "frontend"
    npm = "npm.cmd" if os.name == "nt" else "npm"
    log("Building frontend locally (production API URL)...")
    if not (frontend / "node_modules").exists():
        subprocess.run([npm, "ci"], cwd=frontend, env=env, check=True, shell=os.name == "nt")
    subprocess.run(["npx.cmd" if os.name == "nt" else "npx", "vite", "build"], cwd=frontend, env=env, check=True, shell=os.name == "nt")
    if not (frontend / "dist" / "index.html").exists():
        raise RuntimeError("frontend/dist was not created")


def make_archive() -> None:
    log(f"Creating archive from {LOCAL_ROOT}")

    def filt(ti: tarfile.TarInfo) -> tarfile.TarInfo | None:
        parts = Path(ti.name).parts
        if "frontend" in parts and "dist" in parts:
            return ti
        if any(p in EXCLUDE_DIRS for p in parts):
            return None
        return ti

    if ARCHIVE.exists():
        ARCHIVE.unlink()
    with tarfile.open(ARCHIVE, "w:gz") as tar:
        tar.add(LOCAL_ROOT, arcname="personal-assistant-hub", filter=filt)
    log(f"Archive: {ARCHIVE} ({ARCHIVE.stat().st_size / 1024 / 1024:.1f} MB)")


def main() -> int:
    if not PASSWORD:
        log("Set DEPLOY_ROOT_PASSWORD")
        return 1

    build_frontend_locally()
    make_archive()

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    run(client, "test -f /swapfile || (fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo swap ok)")

    if run(client, "docker --version") != 0:
        log("Installing Docker...")
        if run(client, "curl -fsSL https://get.docker.com | sh", timeout=900) != 0:
            return 1

    run(client, f"mkdir -p {REMOTE_DIR}")
    sftp = client.open_sftp()
    remote_archive = "/tmp/pah-deploy.tar.gz"
    log(f"Uploading {ARCHIVE.name}...")
    sftp.put(str(ARCHIVE), remote_archive)
    sftp.close()

    cmds = [
        f"rm -rf {REMOTE_DIR}/*",
        f"tar -xzf {remote_archive} -C /opt",
        f"find {REMOTE_DIR} -name '*.sh' -exec sed -i 's/\\r$//' {{}} +",
        f"cp {REMOTE_DIR}/deploy/env.production {REMOTE_DIR}/.env",
        f"cd {REMOTE_DIR} && bash deploy/deploy.sh",
    ]
    for cmd in cmds:
        if run(client, cmd, timeout=7200) != 0 and "seed_data" not in cmd:
            client.close()
            return 1

    run(client, f"cd {REMOTE_DIR} && docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml ps")
    client.close()
    log("Deploy finished.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
