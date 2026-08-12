import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { sendChatMessage } from '../api/chatbotApi';

const STORAGE_KEY = 'premier_chat_history';
const SESSION_KEY = 'premier_chat_session';
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

const INITIAL_MESSAGE = {
    from: 'bot',
    text: "Hi! I'm Premier Bot, your passenger support assistant. I can help with general assistance, top-ups, lost-card procedures, and support tickets. How can I help?",
    timestamp: new Date().toISOString(),
    quickReplies: null,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const readStoredMessages = (key) => {
    try {
        const stored = sessionStorage.getItem(key);
        return stored ? JSON.parse(stored) : [INITIAL_MESSAGE];
    } catch {
        return [INITIAL_MESSAGE];
    }
};

const readSessionId = (key) => {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const fresh = uuidv4();
    sessionStorage.setItem(key, fresh);
    return fresh;
};

export const useChatbot = ({ storageScope = 'guest' } = {}) => {
    const scopedStorageKey = useMemo(() => `${STORAGE_KEY}_${storageScope}`, [storageScope]);
    const scopedSessionKey = useMemo(() => `${SESSION_KEY}_${storageScope}`, [storageScope]);

    const [messages, setMessages] = useState(() => readStoredMessages(scopedStorageKey));
    const [isTyping, setIsTyping] = useState(false);
    const [error, setError] = useState(null);
    const sessionId = useRef(readSessionId(scopedSessionKey));

    useEffect(() => {
        sessionId.current = readSessionId(scopedSessionKey);
        setMessages(readStoredMessages(scopedStorageKey));
        setError(null);
    }, [scopedStorageKey, scopedSessionKey]);

    useEffect(() => {
        try {
            const trimmed = messages.slice(-50);
            sessionStorage.setItem(scopedStorageKey, JSON.stringify(trimmed));
        } catch {
            // sessionStorage quota exceeded - fail silently
        }
    }, [messages, scopedStorageKey]);

    const addMessage = useCallback((from, text, quickReplies = null) => {
        setMessages((prev) => [
            ...prev,
            {
                from,
                text,
                timestamp: new Date().toISOString(),
                quickReplies: quickReplies ?? null,
            },
        ]);
    }, []);

    const sendMessage = useCallback(async (text, retryCount = 0) => {
        const trimmed = text?.trim();
        if (!trimmed) return;

        if (retryCount === 0) {
            setError(null);
            addMessage('user', trimmed);
        }

        setIsTyping(true);

        try {
            const data = await sendChatMessage(trimmed, sessionId.current);

            if (!data.success && data.errorCode === 'RATE_LIMITED') {
                addMessage('bot', 'You\'re sending messages too quickly. Please wait a moment and try again.');
                return { ok: false, reason: 'rate_limited' };
            }

            addMessage('bot', data.reply, data.quickReplies);
            return {
                ok: true,
                source: 'api',
                recommendedAction: data.recommendedAction || null,
                intent: data.intent || null,
            };
        } catch (err) {
            const status = err?.response?.status;

            if (status === 429) {
                addMessage('bot', 'Too many messages. Please wait a moment before asking again.');
                return { ok: false, reason: 'rate_limited' };
            }

            if (status === 401) {
                addMessage('bot', 'Please log in first so I can help with your account securely.');
                return { ok: false, reason: 'unauthorized' };
            }

            if (retryCount < MAX_RETRIES) {
                await sleep(RETRY_DELAY_MS);
                return sendMessage(trimmed, retryCount + 1);
            }

            const errMsg =
                err?.response?.data?.reply ||
                'Unable to connect to support. Please try again or call us at (02) 8888-171.';
            addMessage('bot', errMsg);
            setError(errMsg);
            return { ok: false, reason: 'request_failed' };
        } finally {
            setIsTyping(false);
        }
    }, [addMessage]);

    const resetChat = useCallback(() => {
        const newSession = uuidv4();
        sessionId.current = newSession;
        sessionStorage.setItem(scopedSessionKey, newSession);
        sessionStorage.removeItem(scopedStorageKey);
        setMessages([INITIAL_MESSAGE]);
        setError(null);
    }, [scopedSessionKey, scopedStorageKey]);

    return {
        messages,
        isTyping,
        error,
        sendMessage,
        resetChat,
    };
};
