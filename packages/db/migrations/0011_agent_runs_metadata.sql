alter table agent_runs
  add column if not exists model_provider text,
  add column if not exists skill_name text not null default 'generate_trade_plan',
  add column if not exists prompt_version text,
  add column if not exists token_usage_json jsonb,
  add column if not exists execution_eligible boolean;

create index if not exists agent_runs_skill_name_idx
  on agent_runs (skill_name, started_at desc);

create index if not exists agent_runs_prompt_version_idx
  on agent_runs (prompt_version, started_at desc);
