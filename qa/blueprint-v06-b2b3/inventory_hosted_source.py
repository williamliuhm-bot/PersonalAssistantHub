"""Read-only source inventory; never loads .env or contacts hosted services."""
import ast
import json
from pathlib import Path
import re
import sys


def services_from_source(path):
    """Recognize this repo's two-space service blocks, not arbitrary YAML."""
    blocks = {}
    in_services = False
    current = None
    for line in path.read_text(encoding='utf-8').splitlines():
        if '\t' in line:
            raise ValueError('Unsupported Compose source indentation')
        if line == 'services:':
            in_services = True
            continue
        if line and not line.startswith((' ', '#')):
            in_services = False
            current = None
        if not in_services:
            continue
        match = re.fullmatch(r'  ([A-Za-z0-9_-]+):\s*(?:#.*)?', line)
        if match:
            current = match.group(1)
            blocks[current] = []
        elif current:
            blocks[current].append(line)
    if not blocks:
        raise ValueError('Unsupported Compose source layout')
    result = []
    for name, lines in blocks.items():
        role = 'service'
        if name in ('postgres', 'redis', 'caddy'):
            role = name
        for line in lines:
            if re.match(r'\s+command:\s*celery\b', line):
                role = 'celery_worker' if re.search(r'\bworker\b', line) else 'celery_scheduler'
        result.append({'name': name, 'declared_role': role})
    return result


def application_tables(app):
    result = []
    paths = sorted(app.glob('*/app/models.py')) + [app/'shared/models.py']
    for path in paths:
        tree = ast.parse(path.read_text(encoding='utf-8'))
        for node in ast.walk(tree):
            if isinstance(node, ast.Assign) and isinstance(node.value, ast.Constant):
                if any(isinstance(t, ast.Name) and t.id == '__tablename__' for t in node.targets):
                    if isinstance(node.value.value, str):
                        result.append({'table': node.value.value,
                                       'source': path.relative_to(app).as_posix()})
    return result


def inventory(app):
    return {
        'classification': 'STATIC_SOURCE_ONLY_NOT_HOSTED_VERIFICATION',
        'compose': [
            {'source': 'docker-compose.yml',
             'declared_services': services_from_source(app/'docker-compose.yml')},
            {'source': 'deploy/docker-compose.prod.yml',
             'declared_services': services_from_source(app/'deploy/docker-compose.prod.yml')},
        ],
        'orm_table_declarations': application_tables(app),
        'caddy_source_present': (app/'deploy/Caddyfile').is_file(),
        'hosted_ownership_verified': False,
        'hosted_slots_quota_tls_store_verified': False,
        'secrets_or_environment_values_read': False,
    }


if __name__ == '__main__':
    try:
        result = inventory(Path(sys.argv[1]))
    except (OSError, ValueError, SyntaxError, IndexError):
        raise SystemExit('Inventory unavailable: unsupported or unreadable source') from None
    print(json.dumps(result, indent=2))
