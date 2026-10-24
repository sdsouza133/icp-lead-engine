-- Proves CI can start Postgres, apply every migration and run pgTAP.
-- Each tenant table added later gets its own isolation test file next to this one.
begin;

create extension if not exists pgtap with schema extensions;

select plan(1);

select ok(true, 'database is reachable and pgTAP runs');

select * from finish();

rollback;
