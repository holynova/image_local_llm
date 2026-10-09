import json
import sqlite3


class TaskStore:
    """Small local queue snapshot committed atomically, including workflow graphs."""
    def __init__(self, path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(path)
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.execute('CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY, body TEXT NOT NULL)')
        self.db.commit()

    def load(self):
        row = self.db.execute('SELECT body FROM state WHERE id=1').fetchone()
        return json.loads(row[0]) if row else {'status': 'idle', 'tasks': []}

    def save(self, tasks, status):
        with self.db:
            self.db.execute('INSERT OR REPLACE INTO state VALUES (1, ?)',
                            (json.dumps({'status': status, 'tasks': tasks}),))

    def close(self):
        self.db.close()
