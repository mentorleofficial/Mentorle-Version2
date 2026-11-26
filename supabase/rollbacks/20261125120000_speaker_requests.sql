-- Rollback for 20261125120000_speaker_requests.sql
DROP FUNCTION IF EXISTS public.submit_speaker_request(text, text, text, text, text, text, date, text, text, text, text, text, text);
DROP TABLE IF EXISTS public.speaker_requests;
