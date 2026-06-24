-- Rename Contacted → Qualified and add Call Back stage

UPDATE public.pipeline_stages
SET label = 'Qualified'
WHERE label = 'Contacted';

-- Make room for Call Back between Qualified and Site Visit
UPDATE public.pipeline_stages
SET sort_order = sort_order + 1
WHERE sort_order >= 2
  AND label NOT IN ('Call Back', 'Qualified');

INSERT INTO public.pipeline_stages (label, color, sort_order)
SELECT 'Call Back', '#f97316', 2
WHERE NOT EXISTS (
  SELECT 1 FROM public.pipeline_stages WHERE label = 'Call Back'
);
