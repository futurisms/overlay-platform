-- Rollback: Remove backfilled annotation token usage

DELETE FROM token_usage
WHERE agent_name = 'annotate-document';
