import unittest
from pathlib import Path
p=Path(__file__).parent
gate=(p/'06_final_all_functions_gate.sql').read_text()
runner=(p/'run_batch.sh').read_text()
class QA(unittest.TestCase):
 def test_all_functions(self): self.assertIn("FROM pg_proc pr JOIN pg_namespace",gate)
 def test_old_overload_covered(self): self.assertNotIn("FOREACH f IN ARRAY",gate)
 def test_public_acl(self): self.assertIn("acldefault('f',p.proowner)",gate);self.assertIn("acl.grantee=0",gate)
 def test_effective_role_privileges(self): self.assertIn("has_function_privilege(role_name,p.oid,'EXECUTE')",gate)
 def test_roles(self): self.assertIn("'anon','authenticated','blueprint_fence_qa_executor'",gate)
 def test_owner(self): self.assertIn("p.prosecdef AND p.proowner",gate)
 def test_no_login(self): self.assertIn("rolcanlogin OR rolbypassrls",gate)
 def test_force_rls(self): self.assertIn("relforcerowsecurity",gate)
 def test_pg17_guard(self): self.assertIn("170000 AND 179999",gate)
 def test_db_guard(self): self.assertIn("blueprint_qa_",gate)
 def test_final_gate_last(self): self.assertEqual(runner.index("acceptance_timed_expiry.sql") < runner.index("06_final_all_functions_gate.sql"),True)
 def test_wall_clock_patch(self): self.assertIn(r"\ir 05_wall_clock_expiry.sql",(p/'acceptance_wall_clock.sql').read_text())
 def test_expiry_real_sleep(self): self.assertIn("pg_sleep(3)",(p/'acceptance_timed_expiry.sql').read_text())
 def test_runner_failfast(self): self.assertIn("ON_ERROR_STOP=1",runner)
 def test_no_prod(self): self.assertNotIn("tzljrkpqhutdyclklgrt",runner+gate)
 def test_no_external_grants(self): self.assertNotIn("GRANT EXECUTE",gate)
 def test_no_wall_clock_duplicate_seed(self):
  extra=(p/'acceptance_extra.sql').read_text()
  wall=(p/'acceptance_wall_clock.sql').read_text()
  for value in ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cccccccc-cccc-4ccc-8ccc-cccccccccccc','dddddddd-dddd-4ddd-8ddd-dddddddddddd']:
   self.assertIn(value,extra)
   self.assertNotIn(value,wall)
 def test_schema_and_table_effective_grants(self):
  self.assertIn("has_schema_privilege(role_name,'blueprint_fence_qa','CREATE')",gate)
  self.assertIn("has_table_privilege(role_name,c.oid,'INSERT')",gate)
  self.assertIn("has_table_privilege(role_name,c.oid,'UPDATE')",gate)
  self.assertIn("has_table_privilege(role_name,c.oid,'DELETE')",gate)
 def test_absent_roles_are_not_silent_pass(self):
  self.assertIn("NOT RUN: client role % absent",gate)
 def test_expiry_test_comment_consistency(self):
  self.assertIn('actual expiry is tested in acceptance_timed_expiry.sql',(p/'acceptance_wall_clock.sql').read_text())
if __name__=='__main__':unittest.main()
