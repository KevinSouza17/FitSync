-- Grant UPDATE on available_for_booking so professionals can toggle it
-- (was missing, which blocked the entire profile update including is_private)
GRANT UPDATE (available_for_booking) ON profiles TO authenticated;
