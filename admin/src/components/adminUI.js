export const layout = 'min-h-screen grid grid-cols-[15rem_minmax(0,1fr)] bg-[#eef1f4] max-[1060px]:grid-cols-1';
export const workspace = 'min-w-0 p-6 max-[560px]:p-3';

export const headerBar = 'flex items-center justify-between gap-4 mb-5 px-6 py-[1.4rem] rounded-lg bg-white text-maroon border border-border-soft max-[560px]:flex-col max-[560px]:items-start max-[560px]:p-4';
export const eyebrow = 'block text-maroon-soft text-[0.82rem] font-black uppercase tracking-[0.05em]';
export const headerTitle = 'm-0 mt-[0.2rem] text-[clamp(1.4rem,2.5vw,1.8rem)] font-black text-maroon';

export const adminAction = 'inline-flex items-center gap-[0.45rem] min-h-[2.45rem] px-[0.95rem] rounded-lg bg-white text-maroon text-[0.86rem] font-black cursor-pointer border border-border-soft transition-all hover:bg-gold hover:border-gold hover:-translate-y-px';
export const adminActionRefresh = 'inline-flex items-center gap-[0.45rem] min-h-[2.45rem] px-[0.95rem] rounded-lg bg-gold text-maroon border border-gold text-[0.86rem] font-black cursor-pointer transition-all hover:-translate-y-px';
export const adminActionPrimary = 'inline-flex items-center gap-[0.45rem] min-h-[2.45rem] px-[0.95rem] rounded-lg bg-maroon text-white border border-maroon text-[0.86rem] font-black cursor-pointer shadow-[0_4px_14px_rgba(111,47,60,0.28)] transition-all hover:bg-maroon-dark hover:border-maroon-dark hover:-translate-y-px';
export const adminActionGold = 'inline-flex items-center gap-[0.45rem] min-h-[2.45rem] px-[0.95rem] rounded-lg bg-gold text-maroon border border-gold text-[0.86rem] font-black cursor-pointer transition-all hover:-translate-y-px';

export const statsGrid = 'grid grid-cols-3 gap-4 mb-5 max-[1060px]:grid-cols-2 max-[560px]:grid-cols-1';

const statCardBase = 'flex items-center justify-between gap-3 min-h-[5.6rem] px-5 py-[1.05rem] rounded-lg bg-white shadow-[0_10px_26px_rgba(44,36,41,0.08)] border-l-4';
export const statCardVariant = {
    maroon: `${statCardBase} border-maroon`,
    gold: `${statCardBase} border-gold`,
    green: `${statCardBase} border-green-brand`,
    danger: `${statCardBase} border-danger-muted`,
};
export const statLabel = 'block text-text-muted text-[0.78rem] font-extrabold mb-[0.3rem] uppercase tracking-[0.04em]';
export const statValue = 'block text-maroon text-[1.55rem] font-black';
const statIconBase = 'w-[2.85rem] h-[2.85rem] grid place-items-center rounded-[10px] text-[1.2rem]';
export const statIconVariant = {
    maroon: `${statIconBase} bg-maroon/10 text-maroon`,
    gold: `${statIconBase} bg-gold/20 text-[#b78a0e]`,
    green: `${statIconBase} bg-green-brand/10 text-green-brand`,
    danger: `${statIconBase} bg-danger-muted/10 text-danger-muted`,
};

export const dataPanel = 'rounded-lg bg-white shadow-[0_10px_26px_rgba(44,36,41,0.08)] overflow-hidden';
export const dataPanelHeader = 'flex items-center justify-between gap-4 px-5 py-[0.95rem] bg-maroon text-white max-[860px]:flex-col max-[860px]:items-stretch';
export const dataPanelTitle = 'inline-flex items-center gap-[0.55rem] font-black text-[0.95rem]';
export const countPill = 'px-[0.6rem] py-[0.2rem] rounded-full bg-gold text-maroon text-[0.72rem] font-black';
export const searchControl = 'inline-flex items-center gap-2 text-white/85 text-[0.82rem]';
export const searchControlInput = 'min-h-[2.2rem] w-56 px-3 rounded-md border border-transparent outline-none bg-white text-text-main focus:border-gold focus:shadow-[0_0_0_3px_rgba(232,189,71,0.25)] max-[860px]:w-full';

export const tableWrap = 'overflow-x-auto';
export const adminTable = 'w-full min-w-[720px] border-collapse text-text-main';
export const tableTh = 'px-[0.95rem] py-[0.8rem] bg-[#f8f5f6] text-maroon text-[0.76rem] font-black uppercase tracking-[0.04em] text-left border-b-2 border-border-soft whitespace-nowrap';
export const tableTd = 'px-[0.95rem] py-[0.8rem] border-b border-[#f0f0f3] text-[0.85rem] align-middle';
export const tableRow = 'even:bg-[#fafbfc] hover:bg-[#fff7ea]';
export const emptyRow = 'text-center !p-10 text-text-muted italic';
export const loadingRow = 'text-center !p-10 text-text-muted italic';
export const mono = "[font-family:ui-monospace,SFMono-Regular,Menlo,monospace]";

export const balancePositive = 'text-green-brand font-black';

export const statusPillSoftSuccess = 'inline-flex items-center px-[0.65rem] py-[0.22rem] rounded-full text-[0.7rem] font-black tracking-[0.03em] uppercase bg-[#e8f5e9] text-green-brand';
export const statusPillSoftDanger  = 'inline-flex items-center px-[0.65rem] py-[0.22rem] rounded-full text-[0.7rem] font-black tracking-[0.03em] uppercase bg-[#fce4ec] text-danger-muted';
export const statusPillColor = 'inline-flex items-center px-[0.65rem] py-[0.22rem] rounded-full text-white text-[0.7rem] font-black tracking-[0.03em]';
export const actionTag = 'inline-flex items-center px-[0.65rem] py-[0.25rem] rounded-md text-white text-[0.7rem] font-black tracking-[0.02em] whitespace-nowrap';

export const paginationBar = 'flex items-center justify-between gap-4 px-5 py-[0.95rem] border-t border-border-soft text-[0.82rem] text-text-muted max-[560px]:flex-col max-[560px]:items-start';
export const paginationButtons = 'inline-flex gap-[0.3rem]';
export const pageBtn = 'min-w-[2.2rem] min-h-[2.2rem] px-[0.7rem] border border-border-soft rounded-md bg-white text-text-main font-extrabold text-[0.82rem] cursor-pointer enabled:hover:bg-gold enabled:hover:text-maroon enabled:hover:border-gold disabled:opacity-50 disabled:cursor-not-allowed';
export const pageBtnActive = 'min-w-[2.2rem] min-h-[2.2rem] px-[0.7rem] border border-maroon rounded-md bg-maroon text-white font-extrabold text-[0.82rem] cursor-pointer';

export const fieldLabel = 'block mb-2 text-[#343946] font-extrabold text-[0.86rem]';
export const fieldInput = 'flex items-center gap-[0.7rem] min-h-[3.1rem] mb-[1.15rem] px-[0.95rem] border-2 border-[#d9dce2] rounded-lg bg-white text-maroon transition-all focus-within:border-gold focus-within:shadow-[0_0_0_4px_rgba(232,189,71,0.18)]';
export const fieldInputEl = 'w-full min-w-0 border-0 outline-0 bg-transparent text-text-main text-[0.95rem]';

export const primaryButton = 'inline-flex items-center justify-center gap-[0.55rem] w-full min-h-[3.1rem] px-[1.2rem] rounded-lg bg-maroon text-white font-black text-[0.95rem] cursor-pointer transition-all hover:bg-maroon-dark hover:-translate-y-px hover:shadow-[0_10px_20px_rgba(111,47,60,0.22)] disabled:cursor-not-allowed disabled:opacity-65 disabled:hover:transform-none disabled:hover:bg-maroon';
export const secondaryButton = 'inline-flex items-center justify-center gap-[0.45rem] w-full min-h-[2.85rem] px-4 rounded-lg bg-white text-maroon border-[1.5px] border-border-soft font-extrabold text-[0.88rem] cursor-pointer mt-[0.6rem] transition-all hover:bg-page-bg hover:border-maroon-soft';

export const fullLoading = 'w-screen h-screen grid place-items-center bg-page-bg text-text-muted font-extrabold';

export const formCard = 'bg-white rounded-lg p-7 shadow-[0_10px_26px_rgba(44,36,41,0.08)]';
export const centerColumn = 'w-full max-w-[33rem] mx-auto';
