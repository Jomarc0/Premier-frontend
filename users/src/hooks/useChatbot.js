import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { sendChatMessage } from '../api/chatbotApi';

const STORAGE_KEY = 'premier_chat_history';
const SESSION_KEY = 'premier_chat_session';
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

const INITIAL_MESSAGE = {
    from: 'bot',
    text: "Hi! I'm Premier Bot, here to help you with top-up, fare, RFID card, and payment concerns. How can I assist you today?",
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

const isSensitiveCardRequest = (message) => {
    const text = (message || '').toLowerCase();
    return text.includes('lost') ||
        text.includes('stolen') ||
        text.includes('freeze') ||
        text.includes('block my card') ||
        text.includes('deactivate my card');
};

const getGuestReply = (message) => {
    const text = (message || '').toLowerCase();
    if (isSensitiveCardRequest(text)) {
        return 'Please log in first so I can verify your account and find the RFID card linked to you. After login, I can submit a card-freeze request for admin review.';
    }
    if (text.includes('top-up') || text.includes('topup') || text.includes('recharge') || text.includes('load')) {
        return 'For top-up help, log in to your passenger account, open your wallet, and check your pending or completed payment status.';
    }
    if (text.includes('fare') || text.includes('deduct')) {
        return 'Fare deductions are tied to your RFID card account. Please log in first so your fare history can be checked securely.';
    }
    if (text.includes('balance') || text.includes('check')) {
        return 'Please log in first to view your current balance. I cannot show account balance from the public login page.';
    }
    if (text.includes('payment') || text.includes('failed')) {
        return 'For payment concerns, log in and check your transaction history. If payment was deducted but not credited, contact support at (02) 8888-171.';
    }
    if (text.includes('hello') || text.includes('hi') || text.includes('hey')) {
        return 'Hello! I can answer general questions here. For account-specific help like balance, lost card, or transactions, please log in first.';
    }
    return 'I can help with general Premier Transit questions here. Please log in for account-specific help like card freezing, balance, and transaction history.';
};

export const useChatbot = ({ isAuthenticated = false, storageScope = 'guest' } = {}) => {
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

        if (!isAuthenticated) {
            addMessage('bot', getGuestReply(trimmed));
            return;
        }

        setIsTyping(true);

        try {
            const data = await sendChatMessage(trimmed, sessionId.current);

            if (!data.success && data.errorCode === 'RATE_LIMITED') {
                addMessage('bot', 'You\'re sending messages too quickly. Please wait a moment and try again.');
                return;
            }

            addMessage('bot', data.reply, data.quickReplies);
        } catch (err) {
            const status = err?.response?.status;

            if (status === 429) {
                addMessage('bot', 'Too many messages. Please wait a moment before asking again.');
                return;
            }

            if (status === 401) {
                addMessage('bot', 'Please log in first so I can help with your account securely.');
                return;
            }

            if (retryCount < MAX_RETRIES) {
                await sleep(RETRY_DELAY_MS);
                await sendMessage(trimmed, retryCount + 1);
                return;
            }

            const errMsg =
                err?.response?.data?.reply ||
                'Unable to connect to support. Please try again or call us at (02) 8888-171.';
            addMessage('bot', errMsg);
            setError(errMsg);
        } finally {
            setIsTyping(false);
        }
    }, [addMessage, isAuthenticated]);

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
