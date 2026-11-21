-- Budget can be free text ("2-3 Cr", "Flexible", "50L") instead of only a number.
-- Existing numeric values stay as-is in custom_data and are still displayed as "₹X Cr".

update public.field_definitions
set field_type = 'text',
    label = 'Budget'
where entity_type = 'lead'
  and field_key = 'budget';
