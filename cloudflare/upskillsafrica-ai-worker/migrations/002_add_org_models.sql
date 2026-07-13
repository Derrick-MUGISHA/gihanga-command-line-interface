-- Add Upskillsafrica organisation-code gated Azure models.

insert into ai_models (id, display_name, source, provider_model_id, deployment, version, price_tier, capabilities, is_gpt5, daily_quota_required, metadata)
values
  (
    'azure_models/UAF_model_one',
    'UAF_model_one (gpt-5.5, org)',
    'azure_models',
    'gpt-5.5',
    'gpt-5.5',
    '2026-04-24',
    'premium',
    array['chat','code','reasoning'],
    false,
    false,
    '{"deploymentType":"Global Standard","status":"Succeeded","requiresOrgCode":true,"projectEndpoint":"https://rask-resource.services.ai.azure.com/api/projects/rask"}'::jsonb
  ),
  (
    'azure_models/uaf_model_two_alpha',
    'uaf_model_two_alpha (gpt-5.6-luna, org)',
    'azure_models',
    'gpt-5.6-luna',
    'gpt-5.6-luna',
    '2026-07-09',
    'premium',
    array['chat','code','reasoning'],
    false,
    false,
    '{"deploymentType":"Global Standard","status":"Succeeded","requiresOrgCode":true,"projectEndpoint":"https://rask-resource.services.ai.azure.com/api/projects/rask"}'::jsonb
  )
on conflict (id) do update set
  display_name = excluded.display_name,
  source = excluded.source,
  provider_model_id = excluded.provider_model_id,
  deployment = excluded.deployment,
  version = excluded.version,
  price_tier = excluded.price_tier,
  capabilities = excluded.capabilities,
  is_gpt5 = excluded.is_gpt5,
  daily_quota_required = excluded.daily_quota_required,
  metadata = excluded.metadata,
  updated_at = now();
