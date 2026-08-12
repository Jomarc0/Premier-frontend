import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, CheckCircle2, RotateCcw, Send, Wifi, X } from 'lucide-react';
import { useChatbot } from '../hooks/useChatbot';
import { useAuth } from '../context/AuthContext';
import { submitPublicSupportTicket } from '../api/chatbotApi';
import { captureEvent } from '../lib/posthog';
import { formatTime } from '../lib/time';

const STATIC_QUICK_REPLIES = [
  'Contact support',
  'Top-up issue',
  'Fare deduction',
  'Payment failed',
  'Lost RFID card',
  'Check balance',
];

const CARD_REQUEST_TYPES = [
  { value: 'DAMAGED_CARD', label: 'Damaged card' },
  { value: 'TOP_UP_ISSUE', label: 'Top-up issue' },
  { value: 'BALANCE_CONCERN', label: 'Balance concern' },
  { value: 'LOGIN_PROBLEM', label: 'Login problem' },
  { value: 'RFID_NOT_WORKING', label: 'RFID not working' },
  { value: 'OTHER', label: 'Other' },
];

const isExplicitTicketConfirmation = (text) => {
  const value = (text || '').toLowerCase();
  return value === 'yes' || value === 'yes please' || value === 'open ticket' ||
    value === 'create ticket' || value === 'create a ticket' ||
    value === 'submit ticket' || value === 'submit a ticket' ||
    value.includes('i want to submit a ticket') || value.includes('i want to create a ticket');
};

const isLostCardRequest = (text) => {
  const value = (text || '').toLowerCase();
  return (value.includes('lost') || value.includes('stolen') || value.includes('missing'))
    && (value.includes('card') || value.includes('rfid'));
};

const resolveRequestType = (text) => {
  const value = (text || '').toLowerCase();
  if (value.includes('damage') || value.includes('replace')) return 'DAMAGED_CARD';
  if (value.includes('top-up') || value.includes('topup')) return 'TOP_UP_ISSUE';
  if (value.includes('balance')) return 'BALANCE_CONCERN';
  if (value.includes('login')) return 'LOGIN_PROBLEM';
  if (value.includes('rfid') || value.includes('tap')) return 'RFID_NOT_WORKING';
  return 'OTHER';
};

const FloatingChatbot = () => {
  const { passenger } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [cardFormOpen, setCardFormOpen] = useState(false);
  const [cardForm, setCardForm] = useState({ email: '', requestType: 'OTHER', details: '', confirmed: false });
  const [submittingCardRequest, setSubmittingCardRequest] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [ticketContext, setTicketContext] = useState('');
  const { messages, isTyping, sendMessage, resetChat } = useChatbot({
    isAuthenticated: Boolean(passenger),
    storageScope: passenger?.id ? 'passenger-' + passenger.id : 'guest',
  });
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, open, cardFormOpen, formSuccess]);

  const openCardRequestForm = (text = '') => {
    if (!passenger) {
      setFormError('Please log in before creating a support ticket so we can attach it securely to your account.');
      setOpen(true);
      return;
    }
    setFormError('');
    setFormSuccess('');
    const isTicketCommand = isExplicitTicketConfirmation(text);
    setCardForm({
      email: '',
      requestType: isTicketCommand ? 'OTHER' : resolveRequestType(text),
      details: isTicketCommand ? '' : text,
      confirmed: false,
    });
    setCardFormOpen(true);
    setOpen(true);
    captureEvent('passenger_web_support_ticket_form_opened', {
      request_type: isTicketCommand ? 'OTHER' : resolveRequestType(text),
    });
  };

  const openLostCardReport = () => {
    setOpen(false);
    navigate('/report-lost-card');
  };

  const handleSend = async (value) => {
    const text = value || input;
    if (!text.trim()) return;
    setInput('');

    captureEvent('chatbot_message_sent', { authenticated: Boolean(passenger) });
    const result = await sendMessage(text);
    captureEvent(result?.ok ? 'chatbot_response_received' : 'chatbot_error', {
      authenticated: Boolean(passenger),
      reason: result?.reason,
    });
    if (result?.recommendedAction === 'REPORT_LOST_CARD') {
      openLostCardReport();
      return;
    }
    // Keep the dedicated card-protection flow even if an older chatbot
    // response still tries to open the general support-ticket form.
    if (result?.recommendedAction === 'OPEN_SUPPORT_TICKET_FORM' && isLostCardRequest(ticketContext || text)) {
      openLostCardReport();
      return;
    }
    // A support request must be explicitly confirmed. Guidance such as a lost
    // card or a failed top-up must never open a ticket form by itself.
    if (result?.recommendedAction === 'OPEN_SUPPORT_TICKET_FORM' && !isExplicitTicketConfirmation(text)) {
      setTicketContext(text);
    }
    if (result?.recommendedAction === 'OPEN_SUPPORT_TICKET_FORM' && isExplicitTicketConfirmation(text)) {
      openCardRequestForm(ticketContext || text);
    }
  };

  const handleSubmitCardRequest = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cardForm.email.trim())) {
      setFormError('Enter a valid email address for admin confirmation.');
      return;
    }
    if (!cardForm.details.trim()) {
      setFormError('Please describe the issue so the support team can review it.');
      return;
    }
    if (!cardForm.confirmed) {
      setFormError('Please confirm that this request needs support-team review.');
      return;
    }

    setSubmittingCardRequest(true);
    setFormError('');
    setFormSuccess('');
    try {
      const typeLabel = CARD_REQUEST_TYPES.find((item) => item.value === cardForm.requestType)?.label || cardForm.requestType;
      const reason = `${typeLabel}: ${cardForm.details.trim()}`;
      const result = await submitPublicSupportTicket({
          email: cardForm.email.trim(),
          issueType: cardForm.requestType,
          reason,
        });
      captureEvent('passenger_web_support_ticket_submitted', {
        request_type: cardForm.requestType,
      });
      setFormSuccess(result.message || `Your ticket has been submitted successfully. Your ticket number is ${result.ticketNumber}. Please wait for admin confirmation through your email.`);
      setCardFormOpen(false);
    } catch (error) {
      captureEvent('passenger_web_support_ticket_failed', {
        request_type: cardForm.requestType,
      });
      setFormError(error.response?.data?.message || 'Failed to submit card request. Please try again.');
    } finally {
      setSubmittingCardRequest(false);
    }
  };

  const handleReset = () => {
    resetChat();
    setCardFormOpen(false);
    setFormError('');
    setFormSuccess('');
  };

  const closeChat = () => {
    setOpen(false);
    captureEvent('chatbot_closed');
  };

  const lastMessage = messages[messages.length - 1];
  const hasBotQuickReplies = lastMessage?.from === 'bot' && lastMessage?.quickReplies?.length > 0;

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end max-[520px]:bottom-4 max-[520px]:right-4">
      {open && (
        <div className="mb-4 flex h-[30rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-brand-primary px-3 py-3">
            <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-accent shadow-md">
              <Bot size={17} className="text-brand-primary" strokeWidth={2.3} />
              <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-brand-primary ${isTyping ? 'bg-amber-300' : 'bg-emerald-400'}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="m-0 text-sm font-bold leading-tight text-white">Premier Bot</p>
              <p className={`m-0 text-[10px] font-semibold ${isTyping ? 'text-brand-accent' : 'text-emerald-200'}`}>
                {isTyping ? 'Typing...' : 'Online - here to help'}
              </p>
            </div>
            <button type="button" onClick={handleReset} title="Reset conversation" className="grid h-8 w-8 place-items-center rounded-lg border-0 bg-transparent text-white/65 transition hover:bg-white/15 hover:text-white">
              <RotateCcw size={14} strokeWidth={2.5} />
            </button>
            <button type="button" onClick={closeChat} title="Close chat" className="grid h-8 w-8 place-items-center rounded-lg border-0 bg-transparent text-white/65 transition hover:bg-white/15 hover:text-white">
              <X size={15} strokeWidth={2.5} />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-[#f6f7fb] px-3 py-3">
            {messages.map((msg, index) => {
              const isUser = msg.from === 'user';
              const isLast = index === messages.length - 1;
              return (
                <div key={`${msg.timestamp || index}-${index}`} className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    {!isUser && (
                      <div className="mb-4 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-primary shadow">
                        <Bot size={13} className="text-brand-accent" strokeWidth={2} />
                      </div>
                    )}
                    <div className={`flex max-w-[78%] flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
                      <div className={`rounded-2xl px-3 py-2 text-[12px] font-medium leading-relaxed break-words whitespace-pre-line ${isUser ? 'rounded-br-sm bg-brand-primary text-white shadow-md' : 'rounded-bl-sm border border-slate-200 bg-white text-slate-700 shadow-sm'}`}>
                        {msg.text}
                      </div>
                      {msg.timestamp && (
                        <p className="m-0 px-0.5 font-mono text-[9px] text-slate-400">
                          {formatTime(msg.timestamp)}
                        </p>
                      )}
                    </div>
                  </div>

                  {!isUser && isLast && msg.quickReplies?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 pl-9">
                      {msg.quickReplies.map((reply) => (
                        <button key={reply} type="button" onClick={() => reply === 'Report lost card' ? openLostCardReport() : handleSend(reply)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10.5px] font-semibold text-brand-primary shadow-sm transition hover:border-brand-primary hover:bg-brand-primary hover:text-white">
                          {reply}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {formSuccess && (
              <div className="ml-9 rounded-2xl rounded-bl-sm border border-emerald-100 bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-800 shadow-sm">
                <CheckCircle2 size={14} className="mr-1 inline" /> {formSuccess}
              </div>
            )}

            {cardFormOpen && (
              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="m-0 text-[12px] font-black text-brand-primary">Support ticket — other concerns</p>
                    <p className="m-0 mt-0.5 text-[10.5px] font-medium text-slate-500">For top-up, fare, RFID, or account concerns. Lost cards use the separate secure report.</p>
                  </div>
                  <button type="button" onClick={() => setCardFormOpen(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                    <X size={14} />
                  </button>
                </div>

                <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-600">Email address</label>
                <input
                  type="email"
                  value={cardForm.email}
                  onChange={(event) => setCardForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="Where admin can send confirmation"
                  className="mb-2 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] font-semibold text-slate-800 outline-none placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
                />

                <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-600">Request type</label>
                <select
                  value={cardForm.requestType}
                  onChange={(event) => setCardForm((current) => ({ ...current, requestType: event.target.value }))}
                  className="mb-2 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] font-semibold text-slate-800 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
                >
                  {CARD_REQUEST_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>

                <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-600">Details</label>
                <textarea
                  value={cardForm.details}
                  onChange={(event) => setCardForm((current) => ({ ...current, details: event.target.value }))}
                  placeholder="Describe your issue and include a reference number if available."
                  className="min-h-[5.5rem] w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] font-medium text-slate-800 outline-none placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
                />

                <label className="mt-2 flex items-start gap-2 text-[10.5px] font-semibold leading-relaxed text-slate-600">
                  <input
                    type="checkbox"
                    checked={cardForm.confirmed}
                    onChange={(event) => setCardForm((current) => ({ ...current, confirmed: event.target.checked }))}
                    className="mt-0.5 h-4 w-4 accent-brand-primary"
                  />
                  I confirm this request needs admin review.
                </label>

                {formError && <p className="mt-2 text-[10.5px] font-semibold text-red-600">{formError}</p>}

                <button
                  type="button"
                  onClick={handleSubmitCardRequest}
                  disabled={submittingCardRequest}
                  className="mt-3 w-full rounded-xl bg-brand-primary px-3 py-2.5 text-[12px] font-black text-white shadow-md transition hover:bg-brand-primary-dark disabled:cursor-not-allowed disabled:bg-brand-primary/40"
                >
                  {submittingCardRequest ? 'Submitting...' : 'Submit for admin review'}
                </button>
              </div>
            )}

            {isTyping && (
              <div className="flex items-end gap-2 animate-in fade-in duration-150">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-primary shadow">
                  <Bot size={13} className="text-brand-accent" strokeWidth={2} />
                </div>
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:300ms]" />
                </div>
              </div>
            )}

            {!hasBotQuickReplies && !isTyping && !cardFormOpen && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {STATIC_QUICK_REPLIES.map((reply) => (
                  <button key={reply} type="button" onClick={() => handleSend(reply)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10.5px] font-semibold text-slate-600 shadow-sm transition hover:border-brand-primary hover:bg-brand-primary hover:text-white">
                    {reply}
                  </button>
                ))}
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          <div className="flex shrink-0 items-center gap-2 border-t border-slate-100 bg-white px-3 py-2.5">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && !isTyping) handleSend(); }}
              placeholder="Message Premier Bot..."
              disabled={isTyping || cardFormOpen}
              className="min-w-0 flex-1 rounded-xl border border-transparent bg-slate-100 px-3 py-2 text-[12px] font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-primary/40 focus:bg-white focus:ring-2 focus:ring-brand-primary/10 disabled:opacity-50"
            />
            <button type="button" onClick={() => handleSend()} disabled={!input.trim() || isTyping || cardFormOpen} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border-0 bg-brand-primary text-white shadow-md transition hover:bg-brand-primary-dark active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none">
              <Send size={14} strokeWidth={2.5} />
            </button>
          </div>

          <div className="flex items-center justify-center gap-1.5 border-t border-slate-100 bg-white py-1.5">
            <Wifi size={9} className="text-slate-300" />
            <span className="text-[8.5px] font-bold uppercase tracking-widest text-slate-400">Secured by Premier Transit RFID Network</span>
          </div>
        </div>
      )}

      <button type="button" onClick={() => setOpen((current) => {
        const next = !current;
        captureEvent(next ? 'chatbot_opened' : 'chatbot_closed');
        return next;
      })} title="Passenger Support" aria-label={open ? 'Close Passenger Support' : 'Open Passenger Support'} className="relative grid h-12 w-12 place-items-center rounded-xl border border-white/10 bg-brand-primary text-white shadow-md transition hover:-translate-y-0.5 hover:bg-brand-primary-dark hover:shadow-lg active:scale-95">
        {open ? <X size={20} strokeWidth={2.5} /> : <Bot size={21} strokeWidth={2} />}
      </button>
    </div>
  );
};

export default FloatingChatbot;
