/*
# Add macro percentage columns to profiles

Allows users to customize their protein/carbs/fat percentage split.
Defaults: 30% protein, 45% carbs, 25% fat.
The Dashboard will compute gram targets from these + daily_calorie_goal.
*/
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS macro_protein_pct integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS macro_carbs_pct integer NOT NULL DEFAULT 45,
  ADD COLUMN IF NOT EXISTS macro_fat_pct integer NOT NULL DEFAULT 25;

-- Grant UPDATE on new columns to authenticated
GRANT UPDATE (macro_protein_pct, macro_carbs_pct, macro_fat_pct) ON public.profiles TO authenticated;
GRANT SELECT (macro_protein_pct, macro_carbs_pct, macro_fat_pct) ON public.profiles TO authenticated;
GRANT INSERT (macro_protein_pct, macro_carbs_pct, macro_fat_pct) ON public.profiles TO authenticated;
GRANT REFERENCES (macro_protein_pct, macro_carbs_pct, macro_fat_pct) ON public.profiles TO authenticated;
