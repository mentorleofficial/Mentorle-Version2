-- Migration: Add notification trigger for assigned action items

CREATE OR REPLACE FUNCTION public.notify_action_item_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mentor_name   TEXT;
  v_session_title TEXT;
BEGIN
  -- We want to notify the mentee when a mentor assigns an action item.
  -- Notify the mentee when the action item is created by someone other than the mentee.
  IF NEW.created_by <> NEW.mentee_id THEN
    SELECT full_name INTO v_mentor_name FROM users WHERE id = NEW.mentor_id;
    SELECT title INTO v_session_title FROM sessions WHERE id = NEW.session_id;

    INSERT INTO notifications (user_id, title, message, type)
    VALUES (
      NEW.mentee_id,
      'New Action Item Assigned',
      COALESCE(v_mentor_name, 'Mentor') || ' assigned you a new action item: "' || NEW.title || '"' ||
        COALESCE(' for session "' || v_session_title || '"', ''),
      'action_item_assigned'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_action_item ON public.session_action_items;
CREATE TRIGGER trg_notify_action_item
  AFTER INSERT ON public.session_action_items
  FOR EACH ROW EXECUTE FUNCTION public.notify_action_item_event();
