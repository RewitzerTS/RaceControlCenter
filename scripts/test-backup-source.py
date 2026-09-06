import unittest
from backup_source import PRODUCTION_REF, validate_source_db_url


class BackupSourceTests(unittest.TestCase):
    def test_current_direct_and_session_pooler(self):
        validate_source_db_url(f"postgresql://postgres:example@db.{PRODUCTION_REF}.supabase.co:5432/postgres?sslmode=require")
        validate_source_db_url(f"postgresql://postgres.{PRODUCTION_REF}:example@aws-1-eu-west-1.pooler.supabase.com:5432/postgres")

    def test_wrong_targets_and_connection_overrides_are_rejected_without_credentials(self):
        for value in [
            "postgresql://postgres:secret@db.kjccstcbqygxuqkvdaqw.supabase.co:5432/postgres",
            "postgresql://postgres:secret@db.nfvwarlowjqphytqqtxz.supabase.co:5432/postgres",
            f"postgresql://postgres:secret@evil.example:5432/postgres?project={PRODUCTION_REF}",
            f"postgresql://postgres:secret@db.{PRODUCTION_REF}.supabase.co:5432/postgres?host=evil.example",
            f"postgresql://postgres.{PRODUCTION_REF}:secret@evil.pooler.supabase.com.attacker.test/postgres",
            f"postgresql://postgres.{PRODUCTION_REF}:secret@aws-1-eu-west-1.pooler.supabase.com:6543/postgres",
            "not a connection string",
        ]:
            with self.subTest(value=value), self.assertRaises(ValueError) as error:
                validate_source_db_url(value)
            self.assertNotIn("secret", str(error.exception))


if __name__ == "__main__":
    unittest.main()
