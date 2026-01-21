-- persist_chat_message RPC function
-- 使用 Advisory Lock 保证并发安全，避免 seq 空洞

CREATE OR REPLACE FUNCTION persist_chat_message(
    p_thread_id TEXT,
    p_message_id TEXT,
    p_role TEXT,
    p_message_data JSONB
) RETURNS TABLE(
    id UUID, 
    thread_id TEXT, 
    message_id TEXT, 
    role TEXT, 
    seq INT, 
    message_data JSONB, 
    created_at TIMESTAMPTZ, 
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_existing RECORD;
    v_next_seq INT;
    v_result RECORD;
BEGIN
    -- 🔒 Advisory Lock: 同一 thread 内串行操作
    PERFORM pg_advisory_xact_lock(hashtext(p_thread_id));
    
    -- 1. 先检查消息是否已存在（现在是串行的，安全）
    SELECT * INTO v_existing
    FROM chat_messages cm
    WHERE cm.thread_id = p_thread_id AND cm.message_id = p_message_id;
    
    IF FOUND THEN
        -- 消息已存在，只更新 message_data，不改 seq
        UPDATE chat_messages
        SET message_data = p_message_data, updated_at = NOW()
        WHERE chat_messages.thread_id = p_thread_id AND chat_messages.message_id = p_message_id
        RETURNING * INTO v_result;
        
        RETURN QUERY SELECT 
            v_result.id,
            v_result.thread_id,
            v_result.message_id,
            v_result.role,
            v_result.seq,
            v_result.message_data,
            v_result.created_at,
            v_result.updated_at;
        RETURN;
    END IF;
    
    -- 2. 消息不存在，分配新 seq 并插入
    -- 使用内联 seq 分配（因为已有 advisory lock，不需要再调用 get_next_seq）
    SELECT COALESCE(MAX(seq) + 1, 1) INTO v_next_seq
    FROM chat_messages
    WHERE chat_messages.thread_id = p_thread_id;
    
    INSERT INTO chat_messages (thread_id, message_id, role, seq, message_data, created_at, updated_at)
    VALUES (p_thread_id, p_message_id, p_role, v_next_seq, p_message_data, NOW(), NOW())
    RETURNING * INTO v_result;
    
    RETURN QUERY SELECT 
        v_result.id,
        v_result.thread_id,
        v_result.message_id,
        v_result.role,
        v_result.seq,
        v_result.message_data,
        v_result.created_at,
        v_result.updated_at;
    
    -- Advisory Lock 在事务结束时自动释放
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION persist_chat_message(TEXT, TEXT, TEXT, JSONB) TO anon, authenticated, service_role;
