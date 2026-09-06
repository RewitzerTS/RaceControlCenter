import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from backup_source import PRODUCTION_REF

spec = importlib.util.spec_from_file_location('storage_backup', Path(__file__).with_name('backup-public-storage.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class StorageBackupTests(unittest.TestCase):
    def test_empty_private_bucket_is_preserved_as_private(self):
        with tempfile.TemporaryDirectory() as target, patch.dict(os.environ, {
            'SUPABASE_DB_URL': f'postgresql://postgres:example@db.{PRODUCTION_REF}.supabase.co:5432/postgres',
            'RACEVORA_STORAGE_BACKUP_DIR': target,
        }), patch.object(module, 'query_json', side_effect=[[{'id': 'private', 'name': 'private', 'public': False}], []]):
            self.assertEqual(module.main(), 0)
            self.assertFalse(json.loads(Path(target, 'buckets.json').read_text())[0]['public'])

    def test_private_objects_cannot_be_silently_omitted(self):
        with tempfile.TemporaryDirectory() as target, patch.dict(os.environ, {
            'SUPABASE_DB_URL': f'postgresql://postgres:example@db.{PRODUCTION_REF}.supabase.co:5432/postgres',
            'RACEVORA_STORAGE_BACKUP_DIR': target,
        }), patch.object(module, 'query_json', side_effect=[[{'id': 'private', 'name': 'private', 'public': False}], [{'bucket': 'private', 'name': 'evidence.png'}]]), patch.object(module, 'download_object') as download:
            self.assertEqual(module.main(), 3)
            download.assert_not_called()
            self.assertFalse(Path(target, 'storage-manifest.json').exists())


if __name__ == '__main__':
    unittest.main()
