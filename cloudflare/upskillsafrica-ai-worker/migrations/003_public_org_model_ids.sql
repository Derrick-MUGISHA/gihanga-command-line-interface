-- Rename public organisation model IDs to remove Azure wording from user-facing IDs.

update ai_models
set id = 'UAF_model_one', updated_at = now()
where id = 'azure_models/UAF_model_one';

update ai_models
set id = 'uaf_model_two_alpha', updated_at = now()
where id = 'azure_models/uaf_model_two_alpha';
