import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { sendChatMessage } from '../api/chatbotApi';

const STORAGE_KEY   = 'premier_chat_history';
const SESSION_KEY   = 'premier_chat_session';
const MAX_RETRIES   = 2;
const RETRY_DELAY_MS = 1500;

const INITIAL_MESSAGE = {
    from: 'bot',
    text: "👋 Hi! I'm Premier Bot, here to help you with top-up, fare, RFID card, and payment concerns. How can I assist you today?",
    timestamp: new Date().toISOString(),
    quickReplies: null,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const useChatbot = () => {

    const [messages, setMessages] = useState(() => {
        try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [INITIAL_MESSAGE];
        } catch {
        return [INITIAL_MESSAGE];
        }
    });

    const [isTyping, setIsTyping] = useState(false);
    const [error, setError]       = useState(null);
    const sessionId = useRef((() => {
        const existing = sessionStorage.getItem(SESSION_KEY);
        if (existing) return existing;
        const fresh = uuidv4();
        sessionStorage.setItem(SESSION_KEY, fresh);
        return fresh;
    })());

    // Persist messages to sessionStorage whenever they change
    useEffect(() => {
        try {
        // Limit stored history to last 50 messages to avoid storage overflow
        const trimmed = messages.slice(-50);
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
        } catch {
        // sessionStorage quota exceeded — fail silently
        }
    }, [messages]);

    //append a single message to the list 
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

    //send a user message and receive a bot reply
    const sendMessage = useCallback(async (text, retryCount = 0) => {
        const trimmed = text?.trim();
        if (!trimmed) return;

        // Only add the user bubble on the first attempt (not retries)
        if (retryCount === 0) {
        setError(null);
        addMessage('user', trimmed);
        }

        setIsTyping(true);

        try {
        const data = await sendChatMessage(trimmed, sessionId.current);

        // Server returned an error payload
        if (!data.success && data.errorCode === 'RATE_LIMITED') {
            addMessage('bot', 'You\'re sending messages too quickly. Please wait a moment and try again.');
            return;
        }

        addMessage('bot', data.reply, data.quickReplies);

        } catch (err) {
        const status = err?.response?.status;

        // 429 Too Many Requests — don't retry
        if (status === 429) {
            addMessage('bot', 'Too many messages. Please wait a moment before asking again.');
            return;
        }

        // Network / server error — retry up to MAX_RETRIES times
        if (retryCount < MAX_RETRIES) {
            await sleep(RETRY_DELAY_MS);
            await sendMessage(trimmed, retryCount + 1);
            return;
        }

        // All retries exhausted
        const errMsg =
            err?.response?.data?.reply ||
            ' Unable to connect to support. Please try again or call us at (123) 456-7890.';
        addMessage('bot', errMsg);
        setError(errMsg);

        } finally {
        setIsTyping(false);
        }
    }, [addMessage]);

    // Public: clear history and start a fresh Dialogflow session 
    const resetChat = useCallback(() => {
        const newSession = uuidv4();
        sessionId.current = newSession;
        sessionStorage.setItem(SESSION_KEY, newSession);
        sessionStorage.removeItem(STORAGE_KEY);
        setMessages([INITIAL_MESSAGE]);
        setError(null);
    }, []);

    return {
        messages,    // array of { from, text, timestamp, quickReplies }
        isTyping,    // boolean — show typing indicator when true
        error,       // last error message string or null
        sendMessage, // (text: string) => Promise<void>
        resetChat,   // () => void
    };
};