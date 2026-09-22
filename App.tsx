import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, User, Category, CategoryItem, CartItem, Order, ChatMessage, FriendRequest, SocialMessage, Review } from './types';
import { INITIAL_PRODUCTS, MOCK_USERS } from './data';
import { getChatResponse, getRecommendations, analyzeSkinTone, analyzeProductFit } from './aiEngine';
import TryOn from './TryOn';

const API = '/api';

const api = {
  get: (url: string) => fetch(`${API}${url}`).then(r => r.json()),
  post: (url: string, body: any) => fetch(`${API}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
  del: (url: string) => fetch(`${API}${url}`, { method: 'DELETE' }).then(r => r.json()),
  put: (url: string, body: any) => fetch(`${API}${url}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
  upload: (url: string, formData: FormData) => fetch(`${API}${url}`, { method: 'POST', body: formData }).then(r => r.json()),
};

const formatINR = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

// --- SHARED COMPONENTS ---

const Navbar: React.FC<{
  user: User | null;
  cartCount: number;
  onNavigate: (p: string) => void;
  onLogout: () => void;
  search: string;
  setSearch: (s: string) => void;
  notifCount?: number;
  onOpenSocial?: () => void;
  onOpenProfile?: () => void;
  onTrial?: () => void;
}> = ({ user, cartCount, onNavigate, onLogout, search, setSearch, notifCount = 0, onOpenSocial, onOpenProfile, onTrial }) => (
  <header className="sticky top-0 z-[60] bg-white border-b border-slate-200 flip-shadow">
    <div className="container mx-auto px-4 lg:px-8 py-3 flex items-center gap-4 lg:gap-10">
      {/* Logo Section */}
      <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => onNavigate('home')}>
        <div className="bg-[#2874f0] text-white w-10 h-10 rounded-lg flex items-center justify-center shadow-lg">
          <i className="fa-solid fa-bolt-lightning text-xl"></i>
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-xl font-extrabold italic tracking-tight text-[#2874f0]">SmartShop</span>
          <span className="text-[10px] font-bold text-[#ffc200] italic">Explore <span className="text-white bg-[#ffc200] px-1 rounded-sm">Plus</span></span>
        </div>
      </div>

      {/* wide Search Bar - Flipkart/Amazon Style */}
      <div className="flex-grow relative hidden sm:block max-w-2xl">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search for products, brands and more"
          className="w-full bg-[#f0f5ff] border-none rounded-md py-2 px-12 text-sm outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all text-slate-700"
        />
        <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <i className="fa-solid fa-xmark"></i>
          </button>
        )}
      </div>

      {/* User Actions */}
      <div className="flex items-center gap-4 lg:gap-8 shrink-0">
        <div className="relative group">
          {user ? (
            <div className="flex items-center gap-2 cursor-pointer">
              <img src={user.avatar} className="w-8 h-8 rounded-full border border-slate-200" alt="User" />
              <span className="text-sm font-bold hidden lg:block">{user.username} <i className="fa-solid fa-chevron-down text-[10px] ml-1"></i></span>
              {/* Dropdown menu */}
              <div className="absolute top-full right-0 mt-2 w-48 bg-white shadow-2xl rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all border border-slate-100 z-50">
                <div className="p-2 space-y-1">
                  <button onClick={() => onOpenProfile?.()} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 rounded-md flex items-center gap-2"><i className="fa-solid fa-user-pen text-blue-500"></i> My Profile</button>
                  {user.role === 'admin' && <button onClick={() => onNavigate('admin')} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 rounded-md flex items-center gap-2 text-rose-600"><i className="fa-solid fa-user-gear"></i> Admin Panel</button>}
                  <button onClick={onLogout} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 rounded-md flex items-center gap-2 border-t text-slate-500"><i className="fa-solid fa-power-off"></i> Logout</button>
                </div>
              </div>
            </div>
          ) : (
            <button onClick={() => onNavigate('login')} className="bg-[#2874f0] text-white px-8 py-2 rounded font-bold text-sm hover:bg-[#1b58bf] transition-colors shadow-md">
              Login
            </button>
          )}
        </div>

        <button onClick={() => onNavigate('cart')} className="flex items-center gap-2 group text-slate-700 hover:text-[#2874f0] transition-colors relative">
          <div className="relative">
            <i className="fa-solid fa-cart-shopping text-lg"></i>
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold border-2 border-white shadow-sm">
                {cartCount}
              </span>
            )}
          </div>
          <span className="text-sm font-bold hidden md:block">Cart</span>
        </button>

        {user && (
          <button onClick={onOpenSocial} className="relative flex items-center gap-2 text-slate-700 hover:text-indigo-600 transition-colors">
            <div className="relative">
              <i className="fa-solid fa-users text-lg"></i>
              {notifCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold border border-white">
                  {notifCount}
                </span>
              )}
            </div>
            <span className="text-sm font-bold hidden md:block">People</span>
          </button>
        )}

        <button onClick={() => onTrial ? onTrial() : onNavigate('trial')} className="hidden lg:flex items-center gap-2 text-slate-700 hover:text-indigo-600 transition-colors">
          <i className="fa-solid fa-wand-magic-sparkles text-indigo-500"></i>
          <span className="text-sm font-bold">Trial Mirror</span>
        </button>
      </div>
    </div>
  </header>
);

const CategoryBar: React.FC<{
  categories: { name: string; code: string; logoUrl: string; subcategories?: string[] }[];
  onSelect: (c: string, sub?: string) => void;
}> = ({ categories, onSelect }) => {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="bg-white border-b border-slate-200 py-3 hidden sm:block relative z-50 shadow-sm overflow-visible">
      <div className="container mx-auto px-4 lg:px-20 flex justify-between items-center no-scrollbar gap-8">
        {categories.map((cat) => (
          <div
            key={cat.code}
            className="relative group outline-none"
            onMouseEnter={() => setHovered(cat.code)}
            onMouseLeave={() => setHovered(null)}
          >
            <button
              onClick={() => onSelect(cat.name)}
              className="flex flex-col items-center gap-1 min-w-[80px] focus:outline-none"
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${hovered === cat.code ? 'bg-blue-600 shadow-xl shadow-blue-100 rotate-3' : 'bg-slate-50 group-hover:bg-blue-50'}`}>
                <img
                  src={cat.logoUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${cat.name}`}
                  alt={cat.name}
                  className={`w-10 h-10 object-contain transition-all duration-300 ${hovered === cat.code ? 'brightness-0 invert scale-110' : 'group-hover:scale-110'}`}
                />
              </div>
              <span className={`text-xs font-black transition-colors duration-300 ${hovered === cat.code ? 'text-blue-600' : 'text-slate-600'}`}>{cat.name}</span>
            </button>

            {/* Subcategory Mega-Panel */}
            {cat.subcategories && cat.subcategories.length > 0 && hovered === cat.code && (
              <div className="absolute top-[100%] left-0 pt-4 animate-slide-up-fade min-w-[280px] z-[100]">
                <div className="bg-white rounded-3xl shadow-2xl border border-indigo-100 p-5 flex flex-col gap-4 overflow-hidden">
                  <p className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.2em] px-2 flex items-center gap-2">
                    <i className="fa-solid fa-layer-group"></i> Varieties
                  </p>
                  <div className="flex flex-col gap-2">
                    {cat.subcategories.map(sub => (
                      <button
                        key={sub}
                        onClick={() => onSelect(cat.name, sub)}
                        className="flex items-center gap-4 px-4 py-3 rounded-2xl bg-slate-50 border border-transparent hover:border-indigo-300 hover:bg-white hover:shadow-xl hover:shadow-indigo-50 transition-all group/sub text-left"
                      >
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-sm group-hover/sub:bg-indigo-600 group-hover/sub:text-white transition-all">
                          <i className="fa-solid fa-tag text-indigo-200 group-hover/sub:text-white text-xs"></i>
                        </div>
                        <div className="flex-grow">
                          <span className="text-sm font-black text-slate-700 group-hover/sub:text-indigo-600 transition-colors">{sub}</span>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">Premium Choice</p>
                        </div>
                        <i className="fa-solid fa-arrow-right text-[10px] text-slate-300 group-hover/sub:translate-x-1 transition-transform"></i>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── STAR RATING HELPER ──────────────────────────────────────────────────────
const StarRating: React.FC<{ rating: number; size?: string }> = ({ rating, size = 'text-sm' }) => (
  <div className={`flex items-center gap-0.5 ${size}`}>
    {[1, 2, 3, 4, 5].map(s => (
      <i
        key={s}
        className={`fa-solid fa-star ${s <= Math.round(rating) ? 'text-yellow-400' : 'text-slate-200'}`}
      />
    ))}
  </div>
);

// ─── WRITE REVIEW MODAL ───────────────────────────────────────────────────────
const WriteReviewModal: React.FC<{
  productName: string;
  existingRating?: number;
  existingText?: string;
  onClose: () => void;
  onSubmit: (rating: number, text: string) => void;
}> = ({ productName, existingRating = 5, existingText = '', onClose, onSubmit }) => {
  const [rating, setRating] = React.useState(existingRating);
  const [hover, setHover] = React.useState(0);
  const [text, setText] = React.useState(existingText);
  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-xl font-black text-slate-800">Rate & Review</h3>
            <p className="text-sm text-slate-400 mt-1 line-clamp-1">{productName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>
        <div className="mb-6">
          <p className="text-xs font-black uppercase text-slate-500 mb-3 tracking-widest">Your Rating</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(s => (
              <button
                key={s}
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(s)}
                className="text-3xl transition-transform hover:scale-125"
              >
                <i className={`fa-solid fa-star ${s <= (hover || rating) ? 'text-yellow-400' : 'text-slate-200'}`} />
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2 font-medium">
            {['', 'Terrible', 'Bad', 'Okay', 'Good', 'Excellent!'][hover || rating]}
          </p>
        </div>
        <div className="mb-6">
          <p className="text-xs font-black uppercase text-slate-500 mb-3 tracking-widest">Your Review</p>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Share your experience with this product..."
            rows={4}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-medium resize-none outline-none focus:ring-2 focus:ring-blue-200 transition"
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-slate-200 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all">Cancel</button>
          <button
            onClick={() => { if (text.trim() || rating) onSubmit(rating, text.trim()); }}
            className="flex-1 bg-[#2874f0] text-white py-3 rounded-xl font-black shadow-lg hover:bg-[#1b58bf] transition-all"
          >
            Submit Review
          </button>
        </div>
      </div>
    </div>
  );
};
const CheckoutModal: React.FC<{
  cart: CartItem[];
  user: User;
  addresses: string[];
  total: number;
  onClose: () => void;
  onPlaceOrder: (address: string, paymentMethod: string, txId: string) => void;
  onAddAddress: (address: string) => void;
}> = ({ cart, user, addresses, total, onClose, onPlaceOrder, onAddAddress }) => {
  const [step, setStep] = useState(1);
  const [selectedAddr, setSelectedAddr] = useState(addresses[0] || '');
  const [newAddr, setNewAddr] = useState('');
  const [payMethod, setPayMethod] = useState<'Paytm' | 'PhonePe' | 'Razorpay' | 'COD'>('Paytm');
  const [txId, setTxId] = useState('');
  const [paymentDone, setPaymentDone] = useState(false);

  const paymentApps = [
    { id: 'Paytm', icon: '/icons/paytm.jpg', label: 'Paytm UPI' },
    { id: 'PhonePe', icon: '/icons/phonepe.jpg', label: 'PhonePe UPI' },
    { id: 'Razorpay', icon: '/icons/razorpay.webp', label: 'Razorpay Link' }
  ];

  return (
    <div className="fixed inset-0 bg-black/80 z-[250] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row h-[90vh] md:h-[650px]" onClick={e => e.stopPropagation()}>
        {/* Left: Summary */}
        <div className="w-full md:w-1/3 bg-slate-50 p-8 border-r border-slate-100 flex flex-col">
          <h3 className="text-xl font-black text-slate-800 mb-6 italic tracking-tight underline decoration-blue-500 decoration-4 underline-offset-4">Order Summary</h3>
          <div className="flex-grow overflow-y-auto space-y-4 mb-6 pr-2 custom-scrollbar">
            {cart.map(item => (
              <div key={item.product.id} className="flex gap-3 items-center">
                <img src={item.product.image} className="w-12 h-12 object-cover rounded-lg border border-white shadow-sm" alt="" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-700 truncate">{item.product.name}</p>
                  <p className="text-[10px] text-blue-600 font-extrabold tracking-tighter mt-0.5">₹{item.product.price.toLocaleString('en-IN')} × {item.quantity}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-dashed border-slate-200 pt-4 mt-auto">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Payable</span>
              <span className="text-2xl font-black text-[#2874f0]">₹{total.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Right: Steps */}
        <div className="flex-grow p-8 flex flex-col overflow-y-auto custom-scrollbar bg-white">
          <div className="flex items-center gap-4 mb-8">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= 1 ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-100 text-slate-400'}`}>1</div>
            <div className={`h-1 flex-grow rounded transition-all ${step >= 2 ? 'bg-blue-600' : 'bg-slate-100'}`}></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= 2 ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-100 text-slate-400'}`}>2</div>
          </div>

          {step === 1 ? (
            <div className="flex-grow flex flex-col">
              <h4 className="text-2xl font-black text-slate-800 mb-2">Delivery Address</h4>
              <p className="text-sm text-slate-400 mb-6 font-medium">Where should we send your smart choices?</p>

              <div className="flex-grow overflow-y-auto space-y-3 mb-6 pr-2 custom-scrollbar">
                {addresses.map((addr, idx) => (
                  <label key={idx} className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${selectedAddr === addr ? 'bg-blue-50 border-blue-500 shadow-md transform scale-[1.02]' : 'bg-white border-slate-100 hover:border-blue-200'}`}>
                    <input type="radio" checked={selectedAddr === addr} onChange={() => setSelectedAddr(addr)} className="accent-blue-600 w-4 h-4" />
                    <span className="text-sm font-bold text-slate-700 leading-snug">{addr}</span>
                  </label>
                ))}

                <div className="border-2 border-dashed border-slate-100 rounded-xl p-4 bg-slate-50/50">
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Add New Address</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newAddr}
                      onChange={e => setNewAddr(e.target.value)}
                      placeholder="Street, City, Pin..."
                      className="flex-grow bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <button
                      onClick={() => { if (newAddr.trim()) { onAddAddress(newAddr.trim()); setSelectedAddr(newAddr.trim()); setNewAddr(''); } }}
                      className="bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-black shadow-lg hover:bg-black transition-all"
                    >
                      ADD
                    </button>
                  </div>
                </div>
              </div>

              <button
                disabled={!selectedAddr}
                onClick={() => setStep(2)}
                className="w-full bg-[#fb641b] text-white py-4 rounded-xl font-black text-lg shadow-xl shadow-orange-200 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                PROCEED TO PAYMENT →
              </button>
            </div>
          ) : (
            <div className="flex-grow flex flex-col">
              <h4 className="text-2xl font-black text-slate-800 mb-2">Secure Payment</h4>
              <p className="text-sm text-slate-400 mb-6 font-medium">Choose your preferred way to pay</p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {paymentApps.map(app => (
                  <button
                    key={app.id}
                    onClick={() => { setPayMethod(app.id as any); setPaymentDone(false); }}
                    className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all group ${payMethod === app.id ? 'bg-indigo-50 border-indigo-500 shadow-md ring-4 ring-indigo-50' : 'bg-white border-slate-100 hover:border-indigo-200'}`}
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden shadow-sm group-hover:scale-110 transition-transform">
                      <img src={app.icon} className="w-full h-full object-cover" alt="" />
                    </div>
                    <span className={`text-[11px] font-black uppercase tracking-widest ${payMethod === app.id ? 'text-indigo-600' : 'text-slate-400'}`}>{app.label}</span>
                  </button>
                ))}
                <button
                  onClick={() => setPayMethod('COD')}
                  className={`flex items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all ${payMethod === 'COD' ? 'bg-emerald-50 border-emerald-500 shadow-md ring-4 ring-emerald-50' : 'bg-white border-slate-100 hover:border-emerald-200'}`}
                >
                  <i className={`fa-solid fa-hand-holding-dollar text-2xl ${payMethod === 'COD' ? 'text-emerald-500' : 'text-slate-300'}`}></i>
                  <span className={`text-xs font-black uppercase tracking-widest ${payMethod === 'COD' ? 'text-emerald-600' : 'text-slate-400'}`}>Cash on Delivery</span>
                </button>
              </div>

              {payMethod !== 'COD' && (
                <div className="mb-8 animate-slide-up-fade">
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-[0.2em] text-center">Verified Payment Method</p>
                  <div className={`relative p-6 rounded-[2rem] transition-all duration-500 border-2 ${paymentDone ? 'bg-emerald-50 border-emerald-200 shadow-xl shadow-emerald-50' : 'bg-gradient-to-br from-indigo-50 to-white border-indigo-100 shadow-xl shadow-indigo-50'}`}>
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                          <img src={paymentApps.find(a => a.id === payMethod)?.icon} className="w-7 h-7 object-contain" alt="" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-800">{payMethod} Secure Pay</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Encrypted Transaction</p>
                        </div>
                      </div>
                      <div className="px-3 py-1 bg-white rounded-lg border border-slate-100 text-[9px] font-black text-indigo-500 uppercase tracking-widest">Active</div>
                    </div>

                    <div className="space-y-4">
                      <div className="relative">
                        <p className="text-[10px] font-black text-indigo-400 uppercase mb-2 ml-1 tracking-widest">Enter Your UPI Address</p>
                        <input
                          type="text"
                          value={txId}
                          onChange={e => { setTxId(e.target.value); setPaymentDone(false); }}
                          placeholder="e.g. yourname@ybl"
                          className="w-full bg-white/80 border-2 border-indigo-50 rounded-2xl px-6 py-4 text-sm font-black text-indigo-600 outline-none focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-300 transition-all placeholder:text-slate-200 shadow-inner"
                        />
                      </div>

                      {!paymentDone ? (
                        <button
                          disabled={!txId.includes('@')}
                          onClick={() => setPaymentDone(true)}
                          className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-indigo-200 hover:bg-slate-900 active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-2 group"
                        >
                          <i className="fa-solid fa-shield-check group-hover:rotate-12 transition-transform"></i>
                          CONFIRM PAYMENT COMPLETED
                        </button>
                      ) : (
                        <div className="p-4 bg-emerald-500 text-white rounded-2xl flex items-center justify-between shadow-lg shadow-emerald-100 animate-slide-up-fade">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                              <i className="fa-solid fa-check text-xs"></i>
                            </div>
                            <span className="text-xs font-black uppercase tracking-tight">Payment Verified Locally</span>
                          </div>
                          <button onClick={() => setPaymentDone(false)} className="text-[10px] font-black uppercase tracking-widest opacity-80 hover:opacity-100">Edit</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-4 mt-auto">
                <button onClick={() => setStep(1)} className="flex-1 bg-slate-100 text-slate-500 py-4 rounded-xl font-black text-sm hover:bg-slate-200 transition-all uppercase tracking-widest">Back</button>
                <button
                  disabled={payMethod !== 'COD' && (!txId.trim() || !paymentDone)}
                  onClick={() => onPlaceOrder(selectedAddr, payMethod, txId)}
                  className="flex-[2] bg-[#fb641b] text-white py-4 rounded-xl font-black text-lg shadow-xl shadow-orange-200 hover:scale-[1.05] active:scale-[0.95] transition-all disabled:opacity-50"
                >
                  {payMethod === 'COD' ? 'PLACE ORDER' : 'CONFIRM & ORDER'} →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── CONFIRMATION MODAL ──────────────────────────────────────────────────────────
const ConfirmModal: React.FC<{
  title: string;
  message: string;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ title, message, onConfirm, onClose }) => (
  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center" onClick={e => e.stopPropagation()}>
      <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-6">
        <i className="fa-solid fa-triangle-exclamation"></i>
      </div>
      <h3 className="text-xl font-black text-slate-800 mb-2">{title}</h3>
      <p className="text-sm text-slate-400 font-medium mb-8 leading-relaxed">{message}</p>
      <div className="flex gap-4 font-black text-sm">
        <button onClick={onClose} className="flex-1 border border-slate-200 py-3 rounded-xl text-slate-600 hover:bg-slate-50 transition-all">CANCEL</button>
        <button onClick={onConfirm} className="flex-1 bg-rose-500 text-white py-3 rounded-xl shadow-lg shadow-rose-100 hover:bg-rose-600 transition-all">YES, DELETE</button>
      </div>
    </div>
  </div>
);

// ─── PROFILE EDIT MODAL ───────────────────────────────────────────────────────
const SKIN_TONES = [
  { label: 'Fair', color: '#FDDBB4' },
  { label: 'Medium', color: '#D4A574' },
  { label: 'Olive', color: '#C68642' },
  { label: 'Brown', color: '#8D5524' },
  { label: 'Dark', color: '#4A2912' },
] as const;

const ProfileEditModal: React.FC<{
  user: User;
  onSave: (updates: { name?: string; skinTone?: string; imageData?: string }) => void;
  onClose: () => void;
}> = ({ user, onSave, onClose }) => {
  const [name, setName] = React.useState(user.name || '');
  const [imagePreview, setImagePreview] = React.useState('');
  const [imageData, setImageData] = React.useState('');
  const [skinTone, setSkinTone] = React.useState(user.skinTone || '');
  const [detecting, setDetecting] = React.useState(false);
  const [detectMsg, setDetectMsg] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const d = ev.target?.result as string;
      setImagePreview(d); setImageData(d); setDetectMsg('');
      handleDetect(d); // auto-run via aiEngine.ts
    };
    reader.readAsDataURL(file);
  };

  const handleDetect = async (data?: string) => {
    const src = data || imageData;
    if (!src) return;
    setDetecting(true); setDetectMsg('Analyzing your photo with Gemini AI…');
    try {
      const res = await analyzeSkinTone(src);
      setSkinTone(res.skinTone);
      setDetectMsg(`✓ ${res.description}${res.undertone ? ` — ${res.undertone} undertone` : ''}`);
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
        setDetectMsg('⚠ Gemini quota reached for today. Please select your skin tone manually below.');
      } else {
        setDetectMsg('⚠ Could not analyze photo. Please select your skin tone manually.');
      }
    }
    setDetecting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-[#2874f0] to-indigo-600 p-6 text-white flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black flex items-center gap-2"><i className="fa-solid fa-user-pen"></i> Edit Profile</h3>
            <p className="text-xs opacity-70 mt-1">Update your name, photo &amp; skin tone</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"><i className="fa-solid fa-xmark"></i></button>
        </div>
        <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh] custom-scrollbar">
          {/* Avatar section */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <img src={imagePreview || user.avatar} alt="Profile" className="w-24 h-24 rounded-full object-cover border-4 border-blue-100 shadow-lg" />
              <button onClick={() => fileRef.current?.click()} className="absolute bottom-0 right-0 w-8 h-8 bg-[#2874f0] text-white rounded-full flex items-center justify-center shadow-md hover:bg-blue-700 transition-colors">
                <i className="fa-solid fa-camera text-xs"></i>
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            <p className="text-xs text-slate-400 font-medium">Tap the camera icon to change your photo</p>
          </div>
          {/* Skin tone auto-detect status */}
          {imageData && (
            <div className={`border rounded-xl p-4 space-y-2 transition-all ${detecting ? 'bg-purple-50 border-purple-200' : detectMsg.startsWith('✓') ? 'bg-emerald-50 border-emerald-200' : detectMsg ? 'bg-amber-50 border-amber-200' : 'bg-purple-50 border-purple-100'}`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold flex items-center gap-2">
                  {detecting
                    ? <><i className="fa-solid fa-spinner fa-spin text-purple-500"></i><span className="text-purple-700">Analyzing with Gemini AI…</span></>
                    : detectMsg.startsWith('✓')
                      ? <><i className="fa-solid fa-circle-check text-emerald-500"></i><span className="text-emerald-700">Skin tone auto-detected!</span></>
                      : <><i className="fa-solid fa-palette text-amber-500"></i><span className="text-amber-700">Detection result</span></>}
                </p>
                {!detecting && <button type="button" onClick={() => handleDetect()} className="text-[10px] font-bold text-slate-400 hover:text-purple-600 transition-colors"><i className="fa-solid fa-rotate-right mr-1"></i>Re-analyze</button>}
              </div>
              {detectMsg && <p className="text-xs leading-relaxed" style={{ color: detectMsg.startsWith('✓') ? '#065f46' : detectMsg.startsWith('⚠') ? '#92400e' : '#6d28d9' }}>{detectMsg}</p>}
            </div>
          )}
          {/* Name */}
          <div>
            <label className="text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5 block">Display Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-[#f0f5ff] rounded-lg px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500" placeholder="Your full name" />
          </div>
          {/* Skin tone */}
          <div>
            <label className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2 block">Skin Tone <span className="normal-case font-normal text-slate-400">(for product fit analysis)</span></label>
            <div className="flex gap-2 flex-wrap">
              {SKIN_TONES.map(st => (
                <button key={st.label} onClick={() => setSkinTone(st.label)} title={st.label}
                  className={`flex items-center gap-2 px-3 py-2 rounded-full border-2 text-sm font-bold transition-all ${skinTone === st.label ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                  <span className="w-4 h-4 rounded-full border border-white shadow-sm inline-block" style={{ backgroundColor: st.color }}></span>
                  {st.label}
                </button>
              ))}
            </div>
            {skinTone && <p className="text-xs text-slate-400 mt-2">Active: <strong className="text-slate-600">{skinTone}</strong> skin tone</p>}
          </div>
        </div>
        <div className="p-5 border-t bg-slate-50 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-100 transition-colors">Cancel</button>
          <button disabled={saving}
            onClick={async () => { setSaving(true); await onSave({ name: name !== user.name ? name : undefined, skinTone: skinTone || undefined, imageData: imageData || undefined }); setSaving(false); }}
            className="flex-1 py-3 bg-[#2874f0] text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-md disabled:opacity-70 flex items-center justify-center gap-2">
            {saving ? <><i className="fa-solid fa-spinner fa-spin text-xs"></i> Saving…</> : <><i className="fa-solid fa-floppy-disk text-xs"></i> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── SKIN TONE ANALYZER MODAL ─────────────────────────────────────────────────
const SkinToneAnalyzerModal: React.FC<{ product: Product; user: User | null; onClose: () => void }> = ({ product, user, onClose }) => {
  const [loading, setLoading] = React.useState(true);
  const [result, setResult] = React.useState<{ percentage: number; verdict: string; analysis: string; tip: string } | null>(null);
  const [noTone, setNoTone] = React.useState(false);
  const skinTone = user?.skinTone || '';

  React.useEffect(() => {
    if (!skinTone) { setLoading(false); setNoTone(true); return; }
    analyzeProductFit(skinTone, product)
      .then(res => { setResult(res); setLoading(false); })
      .catch((e: any) => {
        const msg = e?.message || '';
        if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
          setResult({ percentage: 0, verdict: 'Unavailable', analysis: 'Gemini API quota exceeded for today. Try again after the quota resets.', tip: 'Your skin tone is saved — the analyzer will work once quota resets.' });
        }
        setLoading(false);
      });
  }, []);

  const verdictStyle: Record<string, string> = {
    'Excellent': 'text-emerald-700 bg-emerald-50 border-emerald-200',
    'Good': 'text-blue-700 bg-blue-50 border-blue-200',
    'Moderate': 'text-amber-700 bg-amber-50 border-amber-200',
    'Not Recommended': 'text-rose-700 bg-rose-50 border-rose-200',
  };
  const pctColor = result ? (result.percentage >= 80 ? '#10b981' : result.percentage >= 60 ? '#3b82f6' : result.percentage >= 40 ? '#f59e0b' : '#ef4444') : '#94a3b8';
  const circ = 2 * Math.PI * 38;

  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-purple-600 to-indigo-700 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><i className="fa-solid fa-palette text-lg"></i></div>
            <div>
              <h3 className="font-black text-lg">Skin Tone Analyzer</h3>
              <p className="text-[11px] opacity-70">Powered by Gemini AI</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30"><i className="fa-solid fa-xmark text-sm"></i></button>
        </div>
        <div className="flex items-center gap-3 p-4 border-b bg-slate-50">
          <img src={product.image} alt={product.name} className="w-12 h-12 rounded-lg object-cover border border-slate-200" />
          <div className="min-w-0">
            <p className="font-bold text-sm text-slate-800 truncate">{product.name}</p>
            <p className="text-xs text-slate-500">{product.category} · {skinTone ? `${skinTone} skin` : 'No tone set'}</p>
          </div>
        </div>
        <div className="p-5 min-h-[180px]">
          {loading && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <i className="fa-solid fa-spinner fa-spin text-4xl text-purple-500"></i>
              <p className="text-slate-500 text-sm font-medium text-center">Analyzing product fit for your skin tone…</p>
            </div>
          )}
          {noTone && !loading && (
            <div className="text-center py-8 space-y-3">
              <i className="fa-solid fa-circle-exclamation text-4xl text-amber-400"></i>
              <p className="text-slate-700 font-bold text-sm">No skin tone set</p>
              <p className="text-slate-400 text-xs px-4">Set your skin tone in your profile to get AI-powered product compatibility analysis.</p>
            </div>
          )}
          {result && !loading && (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-6 py-2">
                <div className="relative w-24 h-24">
                  <svg viewBox="0 0 100 100" className="w-24 h-24 -rotate-90">
                    <circle cx="50" cy="50" r="38" fill="none" stroke="#e2e8f0" strokeWidth="10" />
                    <circle cx="50" cy="50" r="38" fill="none" stroke={pctColor} strokeWidth="10"
                      strokeDasharray={`${circ * result.percentage / 100} ${circ}`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-slate-800 leading-none">{result.percentage}%</span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Match</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <span className={`text-sm font-black px-3 py-1.5 rounded-full border block text-center ${verdictStyle[result.verdict] || 'text-slate-600 bg-slate-50 border-slate-200'}`}>{result.verdict}</span>
                  <p className="text-xs text-slate-400 font-medium text-center">{skinTone} skin tone</p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Gemini Analysis</p>
                <p className="text-sm text-slate-700 leading-relaxed">{result.analysis}</p>
              </div>
              <div className="flex gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3">
                <i className="fa-solid fa-lightbulb text-amber-500 text-sm mt-0.5 shrink-0"></i>
                <p className="text-xs text-amber-800 leading-relaxed font-medium">{result.tip}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── BLOCKCHAIN VERIFIER ─────────────────────────────────────────────────────
interface ChainReport {
  chainExists: boolean;
  productId: string;
  totalBlocks: number;
  verified: number;
  tampered: number;
  integrityPct: number;
  genesisHash: string;
  latestHash: string;
  blocks: Array<{
    blockIndex: number;
    reviewId: string;
    blockHash: string;
    previousHash: string;
    timestamp: string;
    blockValid: boolean;
    isGenesis: boolean;
    hashOk: boolean;
    linkOk: boolean;
    dataOk: boolean;
  }>;
}

const BlockchainVerifier: React.FC<{ productId: string; reviews: Review[] }> = ({ productId, reviews }) => {
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [report, setReport] = React.useState<ChainReport | null>(null);
  const [expanded, setExpanded] = React.useState(false);

  const verify = async () => {
    setStatus('loading');
    try {
      const res = await fetch(`http://localhost:5001/api/reviews/${productId}/verify-chain`);
      if (!res.ok) throw new Error('Failed');
      const data: ChainReport = await res.json();
      setReport(data);
      setStatus('done');
      setExpanded(true);
    } catch {
      setStatus('error');
    }
  };

  const integrityColor =
    !report ? '' :
      report.integrityPct === 100 ? 'text-emerald-600' :
        report.integrityPct >= 80 ? 'text-orange-500' : 'text-red-600';

  const barColor =
    !report ? '' :
      report.integrityPct === 100 ? 'bg-emerald-500' :
        report.integrityPct >= 80 ? 'bg-orange-400' : 'bg-red-500';

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 overflow-hidden">
      {/* Button row */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-link-slash text-violet-500 text-sm" />
          <span className="text-xs font-black uppercase tracking-widest text-violet-700">Blockchain Integrity</span>
        </div>
        <button
          onClick={verify}
          disabled={status === 'loading'}
          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all"
        >
          {status === 'loading'
            ? <><i className="fa-solid fa-circle-notch fa-spin text-[10px]" /> Verifying…</>
            : <><i className="fa-solid fa-shield-halved text-[10px]" /> Verify Chain</>
          }
        </button>
      </div>

      {/* Result panel */}
      {status === 'error' && (
        <div className="px-4 pb-3 text-xs text-red-500 font-bold">
          <i className="fa-solid fa-triangle-exclamation mr-1" />Could not reach backend. Is the server running?
        </div>
      )}

      {status === 'done' && report && (
        <div className="border-t border-violet-200 px-4 pb-4 pt-3 space-y-3">
          {/* Summary stats */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Blocks', value: report.totalBlocks, color: 'text-slate-800' },
              { label: 'Verified', value: report.verified, color: 'text-emerald-600' },
              { label: 'Tampered', value: report.tampered, color: report.tampered > 0 ? 'text-red-600' : 'text-slate-400' },
              { label: 'Integrity', value: `${report.integrityPct}%`, color: integrityColor },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-lg p-2 text-center border border-violet-100">
                <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Chain Validity</span>
              <span className={`text-[9px] font-black ${integrityColor}`}>{report.integrityPct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200">
              <div className={`h-2 rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${report.integrityPct}%` }} />
            </div>
          </div>

          {/* Overall status badge */}
          {report.tampered === 0 ? (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <i className="fa-solid fa-circle-check text-emerald-500" />
              <span className="text-xs font-black text-emerald-700">All {report.totalBlocks} blocks intact — no tampering detected</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <i className="fa-solid fa-triangle-exclamation text-red-500" />
              <span className="text-xs font-black text-red-700">{report.tampered} block(s) failed verification — data may have been altered</span>
            </div>
          )}

          {/* Hashes */}
          <div className="space-y-1">
            <p className="font-mono text-[9px] text-slate-400 truncate" title={report.genesisHash}>
              Genesis: {report.genesisHash.substring(0, 24)}…
            </p>
            <p className="font-mono text-[9px] text-slate-400 truncate" title={report.latestHash}>
              Latest:  {report.latestHash.substring(0, 24)}…
            </p>
          </div>

          {/* Block-by-block list toggle */}
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-[10px] font-black uppercase tracking-widest text-violet-600 hover:text-violet-800"
          >
            {expanded ? '▲ Hide blocks' : '▼ Show all blocks'}
          </button>

          {expanded && (
            <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
              {report.blocks.map(block => (
                <div
                  key={block.blockIndex}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[10px] font-mono border ${block.blockValid
                    ? 'bg-emerald-50 border-emerald-100'
                    : 'bg-red-50 border-red-200'
                    }`}
                >
                  <span className={`font-black w-5 text-center shrink-0 ${block.blockValid ? 'text-emerald-600' : 'text-red-600'}`}>
                    {block.blockValid ? '✓' : '✗'}
                  </span>
                  <span className="text-slate-500 shrink-0">
                    #{block.blockIndex} {block.isGenesis ? '(GENESIS)' : ''}
                  </span>
                  <span className="text-slate-400 truncate flex-1" title={block.blockHash}>
                    {block.blockHash.substring(0, 16)}…
                  </span>
                  {!block.blockValid && (
                    <span className="shrink-0 text-red-500 font-black text-[9px]">
                      {!block.hashOk ? 'HASH BROKEN' : !block.linkOk ? 'LINK BROKEN' : 'DATA CHANGED'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── PRODUCT DETAIL MODAL ─────────────────────────────────────────────────────
const ProductDetailModal: React.FC<{
  product: Product;
  reviews: Review[];
  canReview: boolean;
  onClose: () => void;
  onAddToCart: (p: Product) => void;
  onWriteReview: () => void;
  onTryAR?: () => void;
  onShare?: (p: Product) => void;
}> = ({ product, reviews, canReview, onClose, onAddToCart, onWriteReview, onTryAR, onShare }) => {
  const [imgIdx, setImgIdx] = React.useState(0);
  const [tab, setTab] = React.useState<'details' | 'reviews'>('details');
  const images: string[] = (product as any).images?.length > 0
    ? (product as any).images
    : [product.image];

  const avgRating = reviews.length
    ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length
    : (product.rating || 0);

  const starCounts = [5, 4, 3, 2, 1].map(s => ({
    star: s,
    count: reviews.filter(r => r.rating === s).length,
  }));

  return (
    <div className="fixed inset-0 bg-black/70 z-[150] flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-4 animate-fade-in overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-black text-slate-800 line-clamp-1 pr-4">{product.name}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-3xl leading-none shrink-0">×</button>
        </div>

        <div className="grid md:grid-cols-2 gap-0">
          {/* Left — Image gallery */}
          <div className="relative bg-slate-50 aspect-square">
            <img
              src={images[imgIdx]}
              className="w-full h-full object-cover"
              alt={product.name}
            />
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setImgIdx((imgIdx - 1 + images.length) % images.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white w-8 h-8 rounded-full flex items-center justify-center shadow-md text-slate-700 text-xs"
                >
                  <i className="fa-solid fa-chevron-left" />
                </button>
                <button
                  onClick={() => setImgIdx((imgIdx + 1) % images.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white w-8 h-8 rounded-full flex items-center justify-center shadow-md text-slate-700 text-xs"
                >
                  <i className="fa-solid fa-chevron-right" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {images.map((_: string, i: number) => (
                    <button
                      key={i}
                      onClick={() => setImgIdx(i)}
                      className={`w-2 h-2 rounded-full transition-all ${i === imgIdx ? 'bg-blue-500 w-4' : 'bg-white/70'}`}
                    />
                  ))}
                </div>
              </>
            )}
            {/* Thumbnail strip */}
            {images.length > 1 && (
              <div className="absolute bottom-10 left-2 flex flex-col gap-1 max-h-40 overflow-y-auto">
                {images.map((img: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => setImgIdx(i)}
                    className={`w-10 h-10 rounded-lg overflow-hidden border-2 transition-all ${i === imgIdx ? 'border-blue-500' : 'border-white/50'}`}
                  >
                    <img src={img} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right — Info */}
          <div className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-1 rounded">{product.category}</span>
              <h3 className="text-2xl font-black text-slate-800 mt-2">{product.name}</h3>
              <div className="flex items-center gap-3 mt-2">
                <StarRating rating={avgRating} size="text-base" />
                <span className="text-sm font-bold text-slate-600">{avgRating.toFixed(1)}</span>
                <span className="text-xs text-slate-400 font-medium">({reviews.length} reviews)</span>
              </div>
              <p className="text-3xl font-black text-[#2874f0] mt-3">{formatINR(product.price)}</p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100">
              {(['details', 'reviews'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-5 py-2.5 text-sm font-black uppercase tracking-wide transition-all border-b-2 ${tab === t ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                >
                  {t === 'reviews' ? `Reviews (${reviews.length})` : 'Details'}
                </button>
              ))}
            </div>

            {tab === 'details' && (
              <div className="space-y-4 flex-grow">
                {(product as any).description && (
                  <p className="text-sm text-slate-600 font-medium leading-relaxed">{(product as any).description}</p>
                )}

                {/* AR Try-On — shown for all Sunglasses category products */}
                {product.category === 'Sunglasses' && (
                  <button
                    onClick={() => onTryAR?.()}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-3.5 rounded-xl font-black text-base shadow-lg hover:from-violet-700 hover:to-indigo-700 transition-all"
                  >
                    <span style={{ fontSize: '1.1em' }}>👓</span>
                    Try in AR
                    <span className="ml-1 bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">LIVE</span>
                  </button>
                )}

                <button
                  onClick={() => { onAddToCart(product); onClose(); }}
                  className="w-full bg-[#2874f0] text-white py-4 rounded-xl font-black text-lg shadow-xl hover:bg-[#1b58bf] transition-all mt-auto"
                >
                  <i className="fa-solid fa-cart-plus mr-2" />Add to Cart
                </button>
                {onShare && (
                  <button
                    onClick={() => onShare(product)}
                    className="w-full flex items-center justify-center gap-2 border-2 border-indigo-200 text-indigo-600 py-3 rounded-xl font-black hover:bg-indigo-50 transition-all"
                  >
                    <i className="fa-solid fa-share-nodes"></i> Share with Friend
                  </button>
                )}
              </div>
            )}

            {tab === 'reviews' && (
              <div className="flex-grow space-y-4">
                {/* Rating breakdown */}
                {reviews.length > 0 && (
                  <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-4 mb-3">
                      <span className="text-5xl font-black text-slate-800">{avgRating.toFixed(1)}</span>
                      <div>
                        <StarRating rating={avgRating} size="text-lg" />
                        <p className="text-xs text-slate-400 mt-1">{reviews.length} ratings</p>
                      </div>
                    </div>
                    {starCounts.map(({ star, count }) => (
                      <div key={star} className="flex items-center gap-2 text-xs font-medium">
                        <span className="w-4 text-slate-500">{star}</span>
                        <i className="fa-solid fa-star text-yellow-400 text-[10px]" />
                        <div className="flex-grow bg-slate-200 rounded-full h-2">
                          <div
                            className="bg-yellow-400 h-2 rounded-full transition-all"
                            style={{ width: reviews.length ? `${(count / reviews.length) * 100}%` : '0%' }}
                          />
                        </div>
                        <span className="w-4 text-slate-400">{count}</span>
                      </div>
                    ))}
                  </div>
                )}

                {canReview && (
                  <button
                    onClick={onWriteReview}
                    className="w-full border-2 border-dashed border-blue-300 text-blue-600 py-3 rounded-xl font-black hover:bg-blue-50 transition-all"
                  >
                    <i className="fa-solid fa-pen-to-square mr-2" />Write a Review
                  </button>
                )}

                {/* ── Blockchain Verify Chain Button ── */}
                <BlockchainVerifier productId={product.id} reviews={reviews} />

                {reviews.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8 font-medium">No reviews yet. Be the first!</p>
                ) : (
                  <div className="space-y-4 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                    {reviews.map(r => (
                      <div key={r.id} className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
                        <div className="flex items-start gap-3 mb-2">
                          <img src={r.avatar} className="w-9 h-9 rounded-full border border-slate-100" alt={r.name} />
                          <div className="flex-grow">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-sm text-slate-800">{r.name}</span>
                              <StarRating rating={r.rating} size="text-xs" />
                              {r.isFake && (
                                <span className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                                  FAKE
                                </span>
                              )}
                              {r.chainVerified === true && (
                                <span className="bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
                                  <i className="fa-solid fa-link text-[8px]" /> On-Chain ✓
                                </span>
                              )}
                              {r.chainVerified === false && r.blockHash !== undefined && (
                                <span className="bg-orange-500 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                                  ⚠ Unverified
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">{new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                          </div>
                        </div>
                        {r.text && <p className="text-sm text-slate-600 font-medium leading-relaxed">{r.text}</p>}
                        {r.blockHash && (
                          <p className="mt-2 font-mono text-[9px] text-slate-300 truncate" title={r.blockHash}>
                            🔗 Block #{r.blockIndex} · {r.blockHash.substring(0, 20)}…
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── SHARE PRODUCT MODAL ─────────────────────────────────────────────────────
const ShareProductModal: React.FC<{
  product: Product;
  friends: any[];
  onShare: (friend: any) => void;
  onClose: () => void;
}> = ({ product, friends, onShare, onClose }) => (
  <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4" onClick={onClose}>
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-base font-black text-slate-800">Share with a Friend</h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5 line-clamp-1">{product.name}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
      </div>
      <div className="flex items-center gap-3 px-5 py-3 bg-slate-50 border-b border-slate-100">
        <img src={product.image} className="w-14 h-14 object-cover rounded-lg border border-slate-100 shrink-0" alt={product.name} />
        <div>
          <p className="text-sm font-black text-slate-800 line-clamp-1">{product.name}</p>
          <p className="text-blue-600 font-black text-sm">₹{product.price.toLocaleString('en-IN')}</p>
          <p className="text-[10px] text-slate-400">{product.category} · ⭐ {product.rating}</p>
        </div>
      </div>
      <div className="px-5 py-4">
        {friends.length === 0 ? (
          <div className="text-center py-6">
            <i className="fa-solid fa-user-group text-3xl text-slate-300 mb-2 block"></i>
            <p className="text-sm text-slate-400 font-medium">No friends added yet.</p>
            <p className="text-xs text-slate-400">Add friends from the People panel to share products.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Select a friend to send to</p>
            {friends.map((f: any) => (
              <button
                key={f.id}
                onClick={() => { onShare(f); onClose(); }}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-blue-300 hover:bg-blue-50 transition-all group"
              >
                <img src={f.avatar} className="w-9 h-9 rounded-full border border-slate-100 shrink-0" alt={f.name} />
                <div className="text-left flex-grow">
                  <p className="text-sm font-black text-slate-800">{f.name || f.username}</p>
                  <p className="text-[10px] text-slate-400">@{f.username}</p>
                </div>
                <span className="text-blue-400 group-hover:text-blue-600 transition-colors text-xs font-black uppercase tracking-wide flex items-center gap-1">
                  <i className="fa-solid fa-paper-plane"></i> Send
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
);

const ProductCard: React.FC<{ product: Product, onAddToCart: (p: Product) => void, onNavigate: (p: string) => void, onProductClick: (p: Product) => void, onShare?: (p: Product) => void, onAnalyze?: (p: Product) => void }> = ({ product, onAddToCart, onNavigate, onProductClick, onShare, onAnalyze }) => {
  const [imgIdx, setImgIdx] = React.useState(0);
  const images: string[] = (product as any).images && (product as any).images.length > 0
    ? (product as any).images.map((u: string) => u.startsWith('/api') ? u : u)
    : [product.image];
  const hasMulti = images.length > 1;

  return (
    <div className="bg-white p-3 product-shadow transition-all duration-300 flex flex-col h-full cursor-pointer rounded-lg group" onClick={() => onProductClick(product)}>
      <div className="relative aspect-[1/1.2] rounded-md overflow-hidden bg-slate-50 mb-3">
        <img src={images[imgIdx]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={product.name} />
        {hasMulti && (
          <>
            <button onClick={(e) => { e.stopPropagation(); setImgIdx((imgIdx - 1 + images.length) % images.length); }} className="absolute left-1 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white w-7 h-7 rounded-full flex items-center justify-center shadow-md text-slate-700 text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10"><i className="fa-solid fa-chevron-left"></i></button>
            <button onClick={(e) => { e.stopPropagation(); setImgIdx((imgIdx + 1) % images.length); }} className="absolute right-1 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white w-7 h-7 rounded-full flex items-center justify-center shadow-md text-slate-700 text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10"><i className="fa-solid fa-chevron-right"></i></button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
              {images.map((_: string, i: number) => <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === imgIdx ? 'bg-blue-500 w-3' : 'bg-white/70'}`} />)}
            </div>
          </>
        )}
        {product.popularityScore > 0.9 && (
          <span className="absolute top-2 left-2 bg-[#ffc200] text-slate-900 text-[10px] font-black px-2 py-0.5 rounded shadow-sm">NEW SEASON 2026</span>
        )}
        {product.stock !== undefined && product.stock <= 5 && product.stock > 0 && (
          <span className="absolute top-8 left-2 bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-sm animate-pulse">ONLY {product.stock} LEFT</span>
        )}
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-slate-100/60 backdrop-blur-[2px] flex items-center justify-center z-10">
            <span className="bg-slate-900 text-white text-xs font-black px-4 py-2 rounded-full shadow-2xl skew-y-[-5deg]">OUT OF STOCK</span>
          </div>
        )}
        {onShare && (
          <button
            onClick={(e) => { e.stopPropagation(); onShare(product); }}
            title="Share with friend"
            className="absolute top-2 right-2 bg-white/90 hover:bg-white w-7 h-7 rounded-full flex items-center justify-center shadow-md text-indigo-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10"
          >
            <i className="fa-solid fa-share-nodes"></i>
          </button>
        )}
        {onAnalyze && (
          <button
            onClick={(e) => { e.stopPropagation(); onAnalyze(product); }}
            title="Skin tone compatibility"
            className="absolute top-10 right-2 bg-white/90 hover:bg-white w-7 h-7 rounded-full flex items-center justify-center shadow-md text-purple-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10"
          >
            <i className="fa-solid fa-palette"></i>
          </button>
        )}
      </div>

      <div className="flex-grow">
        <h3 className="text-sm font-bold text-slate-800 line-clamp-1 mb-1 group-hover:text-blue-600 transition-colors">{product.name}</h3>
        <div className="flex items-center gap-2 mb-2">
          <div className="bg-green-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm flex items-center gap-1">
            {product.rating} <i className="fa-solid fa-star text-[8px]"></i>
          </div>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{product.category}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-black text-slate-900">{formatINR(product.price)}</span>
          <span className="text-xs text-slate-400 line-through">₹{product.price + 500}</span>
          <span className="text-xs text-green-600 font-bold">20% off</span>
        </div>
      </div>
      <button
        disabled={product.stock === 0}
        onClick={(e) => { e.stopPropagation(); if (product.stock !== 0) onAddToCart(product); }}
        className={`mt-4 w-full py-2.5 rounded-sm font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2 ${product.stock === 0 ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-[#fb641b] text-white hover:bg-[#e65a15]'}`}
      >
        <i className="fa-solid fa-cart-shopping"></i> {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
      </button>
    </div>
  );
};

// --- MAIN APP COMPONENT ---

export default function App() {
  const [view, setView] = useState('home');
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('smartshop_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('All');
  const [newCatName, setNewCatName] = useState('');
  const [newCatFile, setNewCatFile] = useState<File | null>(null);
  const [newCatPreview, setNewCatPreview] = useState('');
  const [newCatLoading, setNewCatLoading] = useState(false);
  const [newProdCat, setNewProdCat] = useState<string>('');
  const [occasions, setOccasions] = useState<{ id: string; name: string; tag: string; productIds: string[] }[]>([]);
  const [newOccName, setNewOccName] = useState('');
  const [newOccTag, setNewOccTag] = useState('');
  const [newOccProductIds, setNewOccProductIds] = useState<string[]>([]);
  const [newOccLoading, setNewOccLoading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [allAdminOrders, setAllAdminOrders] = useState<any[]>([]);
  const [shareModalProduct, setShareModalProduct] = useState<Product | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [analyzerProduct, setAnalyzerProduct] = useState<Product | null>(null);
  const [regImageData, setRegImageData] = useState('');
  const [regSkinTone, setRegSkinTone] = useState('');
  const [regDetecting, setRegDetecting] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [unreadChat, setUnreadChat] = useState(0);
  const [unreadSocial, setUnreadSocial] = useState(0);
  const chatOpenRef = useRef(false);
  const socialOpenRef = useRef(false);
  const socialMsgCountRef = useRef(0);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>('All');
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [authError, setAuthError] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // Social Chat State
  const [socialOpen, setSocialOpen] = useState(false);
  const [socialTab, setSocialTab] = useState<'people' | 'friends' | 'requests'>('people');
  const [socialUsers, setSocialUsers] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [activeChatFriend, setActiveChatFriend] = useState<any>(null);
  const [socialMessages, setSocialMessages] = useState<SocialMessage[]>([]);
  const [socialInput, setSocialInput] = useState('');
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [showShareProduct, setShowShareProduct] = useState(false);
  const socialChatEndRef = useRef<HTMLDivElement>(null);

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotMsg, setForgotMsg] = useState('');
  const [newSubcatName, setNewSubcatName] = useState('');

  // AR Try-On state
  const [arOpen, setArOpen] = useState(false);
  const [arModelUrl, setArModelUrl] = useState<string | undefined>(undefined);

  // Reviews state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productDetailOpen, setProductDetailOpen] = useState(false);
  const [productReviews, setProductReviews] = useState<Review[]>([]);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ productId: string; productName: string } | null>(null);

  // New features state
  const [viewingSubcatFor, setViewingSubcatFor] = useState<string | null>(null); // code of category
  const [userAddresses, setUserAddresses] = useState<string[]>([]);
  const [orderAddress, setOrderAddress] = useState('');
  const [orderPaymentMethod, setOrderPaymentMethod] = useState<'Paytm' | 'PhonePe' | 'Razorpay' | 'COD'>('Paytm');
  const [orderTxId, setOrderTxId] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);

  // General confirmation dialog
  const [confirmData, setConfirmData] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmData({ title, message, onConfirm });
  };

  const loadAllOrders = async () => {
    try { const data = await api.get('/orders'); setAllAdminOrders(Array.isArray(data) ? data : []); } catch { }
  };

  const shareProductToFriend = async (friend: any, product: Product) => {
    if (!user) return;
    try {
      await api.post(`/social/chat/${user.id}/${friend.id}`, {
        senderId: user.id,
        type: 'product',
        text: `Check out: ${product.name}`,
        product,
      });
    } catch { }
  };

  const handleProfileSave = async (updates: { name?: string; skinTone?: string; imageData?: string }) => {
    if (!user) return;
    try {
      if (updates.imageData) {
        const uploadRes = await api.post(`/upload/profile-image/${user.id}`, { imageData: updates.imageData });
        if (uploadRes.user) {
          const updated = { ...user, ...uploadRes.user };
          setUser(updated);
          localStorage.setItem('smartshop_user', JSON.stringify(updated));
        }
      }
      const profileUpdates: any = {};
      if (updates.name) profileUpdates.name = updates.name;
      if (updates.skinTone !== undefined) profileUpdates.skinTone = updates.skinTone;
      if (Object.keys(profileUpdates).length > 0) {
        const res = await api.put(`/users/${user.id}/profile`, profileUpdates);
        if (res.user) {
          const updated = { ...user, ...res.user };
          setUser(updated);
          localStorage.setItem('smartshop_user', JSON.stringify(updated));
        }
      }
      setProfileModalOpen(false);
    } catch { }
  };

  const handleDetectRegSkinTone = async (imageData: string) => {
    setRegDetecting(true);
    try {
      const res = await analyzeSkinTone(imageData);
      if (res.skinTone) setRegSkinTone(res.skinTone);
    } catch { /* quota or error — user can pick manually */ }
    setRegDetecting(false);
  };

  // Load products from backend
  const loadProducts = async () => {
    try {
      const data = await api.get('/products');
      const mapped = data.map((p: any) => ({
        ...p,
        image: p.images && p.images.length > 0 ? p.images[0] : 'https://via.placeholder.com/400',
      }));
      setProducts(mapped);
    } catch { setProducts([]); }
  };

  // Load categories from backend
  const loadCategories = async () => {
    try {
      const data = await api.get('/categories');
      if (Array.isArray(data)) setCategories(data);
    } catch { }
  };

  // Load occasions from backend
  const loadOccasions = async () => {
    try {
      const data = await api.get('/occasions');
      if (Array.isArray(data)) setOccasions(data);
    } catch { }
  };

  // Load cart from backend
  const loadCart = async (uid: string) => {
    try {
      const data = await api.get(`/cart/${uid}`);
      const mapped = data.map((item: any) => ({
        product: { ...item.product, image: item.product.images?.[0] || '' },
        quantity: item.quantity,
      }));
      setCart(mapped);
    } catch { setCart([]); }
  };

  const loadUsers = async () => {
    try { const data = await api.get('/users'); setAllUsers(data); } catch { }
  };

  // ─── Social API ──────────────────────────────────────────────────────────
  const loadSocialUsers = async () => {
    try { const data = await api.get('/social/users'); setSocialUsers(data); } catch { }
  };

  const loadFriends = async (uid: string) => {
    try {
      const data = await api.get(`/social/friends/${uid}`);
      setFriends(data);
    } catch { }
  };

  const loadFriendRequests = async (uid: string) => {
    try {
      const data = await api.get(`/social/requests/${uid}`);
      setFriendRequests(data);
      // Track what requests we have already sent (stored in my own incoming list as sender)
      const sent = new Set<string>(data.filter((r: FriendRequest) => r.status === 'pending').map((r: FriendRequest) => r.fromId));
      setSentRequests(sent);
    } catch { }
  };

  const sendFriendReq = async (toId: string) => {
    if (!user) return;
    try {
      await api.post('/social/request', { fromId: user.id, toId });
      setSentRequests(prev => new Set(prev).add(toId));
    } catch { }
  };

  const respondToReq = async (reqId: string, action: 'accept' | 'decline') => {
    if (!user) return;
    await api.put(`/social/request/${reqId}`, { userId: user.id, action });
    await loadFriendRequests(user.id);
    await loadFriends(user.id);
  };

  const loadConversation = async (friendId: string) => {
    if (!user) return;
    try {
      const data = await api.get(`/social/chat/${user.id}/${friendId}`);
      const newCount = Array.isArray(data) ? data.length : 0;
      if (!socialOpenRef.current && newCount > socialMsgCountRef.current) {
        setUnreadSocial(prev => prev + (newCount - socialMsgCountRef.current));
      }
      socialMsgCountRef.current = newCount;
      setSocialMessages(data);
      setTimeout(() => socialChatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    } catch { }
  };

  const sendSocialMessage = async (text: string, type: 'text' | 'product' = 'text', product?: Product) => {
    if (!user || !activeChatFriend) return;
    const body: any = { senderId: user.id, type, text };
    if (product) body.product = product;
    try {
      await api.post(`/social/chat/${user.id}/${activeChatFriend.id}`, body);
      await loadConversation(activeChatFriend.id);
    } catch { }
  };

  const pollSocial = () => {
    if (!user) return;
    loadFriendRequests(user.id);
    if (activeChatFriend) loadConversation(activeChatFriend.id);
  };

  useEffect(() => {
    if (!user || !socialOpen) return;
    loadSocialUsers();
    loadFriends(user.id);
    loadFriendRequests(user.id);
  }, [user, socialOpen]);

  useEffect(() => {
    const t = setInterval(pollSocial, 5000);
    return () => clearInterval(t);
  }, [user, activeChatFriend]);

  useEffect(() => { chatOpenRef.current = chatOpen; if (chatOpen) setUnreadChat(0); }, [chatOpen]);
  useEffect(() => { socialOpenRef.current = socialOpen; if (socialOpen) setUnreadSocial(0); }, [socialOpen]);

  useEffect(() => { loadProducts(); loadCategories(); loadOccasions(); }, []);
  useEffect(() => { if (user) { loadCart(user.id); loadOrders(user.id); if (user.role === 'admin') { loadUsers(); loadAllOrders(); } loadFriendRequests(user.id); loadFriends(user.id); } else { setCart([]); setOrders([]); } }, [user]);

  // Hero Carousel State
  const [currentHero, setCurrentHero] = useState(0);
  const heroBanners = [
    { title: "BIG BACHAT DAYS", sub: "1st - 5th FEB", tag: "NEW SEASON 2026", bg: "bg-gradient-to-r from-[#2193b0] to-[#6dd5ed]", img: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=1200" },
    { title: "FASHION FESTIVAL", sub: "UP TO 80% OFF", tag: "LIMITED TIME", bg: "bg-gradient-to-r from-[#8e2de2] to-[#4a00e0]", img: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=1200" }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHero(prev => (prev + 1) % heroBanners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Login / Register via backend
  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError('');
    const fd = new FormData(e.currentTarget);
    const name = fd.get('name') as string || '';
    const username = fd.get('username') as string;
    const password = fd.get('password') as string;
    const email = fd.get('email') as string || '';

    try {
      if (isRegister) {
        const res = await api.post('/auth/register', { name, username, password, email, skinTone: regSkinTone || undefined });
        if (res.error) { setAuthError(res.error); return; }
        let registeredUser = res.user;
        if (regImageData && registeredUser?.id) {
          try {
            const uploadRes = await api.post(`/upload/profile-image/${registeredUser.id}`, { imageData: regImageData });
            if (uploadRes.user) registeredUser = uploadRes.user;
          } catch { }
        }
        localStorage.setItem('smartshop_user', JSON.stringify(registeredUser));
        setUser(registeredUser);
        setRegImageData(''); setRegSkinTone('');
        setView('home');
      } else {
        const res = await api.post('/auth/login', { username, password });
        if (res.error) { setAuthError(res.error); return; }
        localStorage.setItem('smartshop_user', JSON.stringify(res.user));
        setUser(res.user);
        setView(res.user.role === 'admin' ? 'admin' : 'home');
      }
    } catch { setAuthError('Server not reachable. Start Flask backend.'); }
  };

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setForgotMsg('');
    const fd = new FormData(e.currentTarget);
    const username = fd.get('fpUsername') as string;
    const email = fd.get('fpEmail') as string;
    try {
      const res = await api.post('/auth/forgot-password', { username, email });
      if (res.error) { setForgotMsg(`❌ ${res.error}`); return; }
      setForgotMsg(`✅ Temporary password: ${res.tempPassword}`);
    } catch { setForgotMsg('❌ Server not reachable.'); }
  };

  const addToCart = async (product: Product) => {
    if (!user) { setView('login'); return; }
    await api.post(`/cart/${user.id}`, { productId: product.id });
    loadCart(user.id);
  };

  const updateCartQty = async (productId: string, quantity: number) => {
    if (!user) return;
    await api.put(`/cart/${user.id}/${productId}`, { quantity });
    loadCart(user.id);
  };

  const removeCartItem = async (productId: string) => {
    if (!user) return;
    await api.del(`/cart/${user.id}/${productId}`);
    loadCart(user.id);
  };

  const handleCheckout = async () => {
    if (!user) return;
    try {
      const data = await api.get(`/address/${user.id}`);
      setUserAddresses(Array.isArray(data) ? data : []);
      setShowCheckout(true);
    } catch {
      setUserAddresses([]);
      setShowCheckout(true);
    }
  };

  const loadOrders = async (uid: string) => {
    try {
      const data = await api.get(`/orders/${uid}`);
      setOrders(data.map((o: any) => ({
        id: o.id,
        items: o.items.map((i: any) => ({
          product: { id: i.productId, name: i.name, category: i.category, price: i.price, image: i.image || '', description: '', rating: 0, popularityScore: 0 },
          quantity: i.quantity,
        })),
        total: o.total,
        address: o.address,
        date: new Date(o.date),
      })));
    } catch { setOrders([]); }
  };

  const handleChat = async (text: string) => {
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text, timestamp: new Date() };
    const newHistory = [...chatMessages, userMsg];
    setChatMessages(newHistory);

    try {
      const reply = await getChatResponse(newHistory, products);
      const botMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: reply, timestamp: new Date() };
      setChatMessages(prev => [...prev, botMsg]);
      if (!chatOpenRef.current) setUnreadChat(prev => prev + 1);
    } catch (err: any) {
      const botMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: err?.message || '⚠️ AI unavailable.', timestamp: new Date() };
      setChatMessages(prev => [...prev, botMsg]);
      if (!chatOpenRef.current) setUnreadChat(prev => prev + 1);
    }
  };

  // ─── Reviews API ──────────────────────────────────────────────────────────
  const loadReviews = async (productId: string) => {
    try {
      const data = await api.get(`/reviews/${productId}`);
      setProductReviews(Array.isArray(data) ? data : []);
    } catch { setProductReviews([]); }
  };

  const openProductDetail = (product: Product) => {
    setSelectedProduct(product);
    setProductDetailOpen(true);
    loadReviews(product.id);
  };

  const submitReview = async (rating: number, text: string) => {
    if (!user || !reviewTarget) return;
    await api.post(`/reviews/${reviewTarget.productId}`, {
      userId: user.id,
      username: user.username,
      name: user.name || user.username,
      avatar: user.avatar,
      rating,
      text,
    });
    setReviewModalOpen(false);
    // Refresh reviews if detail modal is open for the same product
    if (selectedProduct?.id === reviewTarget.productId) {
      loadReviews(reviewTarget.productId);
    }
    // Reload products to pick up updated average rating
    loadProducts();
  };

  const hasReviewed = (productId: string) =>
    productReviews.some(r => r.userId === user?.id && r.productId === productId);

  const hasPurchased = (productId: string) =>
    orders.some(o => o.items.some(i => i.product.id === productId));

  const handleDeleteUser = (uid: string, uname: string) => {
    showConfirm("Delete User?", `Are you sure you want to remove user "${uname}"? This action cannot be undone.`, async () => {
      await api.del(`/users/${uid}`);
      loadUsers();
    });
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
      const matchesSub = selectedSubcategory === 'All' || p.subcategory === selectedSubcategory;
      return matchesSearch && matchesCat && matchesSub;
    });
  }, [products, search, selectedCategory, selectedSubcategory]);


  return (
    <div className="min-h-screen flex flex-col">
      <Navbar
        user={user}
        cartCount={cart.reduce((a, b) => a + b.quantity, 0)}
        onNavigate={setView}
        onLogout={() => { localStorage.removeItem('smartshop_user'); setUser(null); setView('home'); }}
        search={search}
        setSearch={setSearch}
        notifCount={friendRequests.filter(r => r.status === 'pending').length + unreadSocial}
        onOpenSocial={() => { setSocialOpen(true); setUnreadSocial(0); }}
        onOpenProfile={() => setProfileModalOpen(true)}
        onTrial={() => { setArModelUrl(undefined); setArOpen(true); }}
      />
      <CategoryBar
        categories={categories}
        onSelect={(c, sub) => {
          setSelectedCategory(c);
          setSelectedSubcategory(sub || 'All');
          setView('shop');
        }}
      />

      <main className="flex-grow">
        {/* LOGIN / REGISTER VIEW */}
        {view === 'login' && (
          <div className="min-h-[80vh] flex items-center justify-center px-4 bg-slate-50">
            <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-2xl animate-fade-in border border-slate-100">
              <div className="text-center mb-8">
                <div className="bg-[#2874f0] w-16 h-16 rounded-2xl flex items-center justify-center text-white text-3xl mx-auto mb-4 shadow-xl">
                  <i className={`fa-solid ${isRegister ? 'fa-user-plus' : 'fa-lock'}`}></i>
                </div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">{isRegister ? 'Create Account' : 'Login to SmartShop'}</h2>
                <p className="text-slate-400 mt-1 text-sm font-medium">{isRegister ? 'Join the 2026 shopping experience' : 'Access your personalized 2026 collections'}</p>
              </div>
              {authError && <div className="bg-rose-50 text-rose-600 text-sm font-bold p-3 rounded mb-4 text-center border border-rose-100"><i className="fa-solid fa-circle-exclamation mr-2"></i>{authError}</div>}

              {showForgot ? (
                <div>
                  <h3 className="text-base font-black text-slate-700 mb-4"><i className="fa-solid fa-key text-yellow-500 mr-2"></i>Reset Password</h3>
                  {forgotMsg && <div className={`text-sm font-bold p-3 rounded mb-4 ${forgotMsg.startsWith('\u2705') ? 'bg-green-50 text-green-700' : 'bg-rose-50 text-rose-600'}`}>{forgotMsg}</div>}
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <input name="fpUsername" type="text" required placeholder="Username" className="w-full bg-[#f0f5ff] border-none rounded py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    <input name="fpEmail" type="email" required placeholder="Registered Email" className="w-full bg-[#f0f5ff] border-none rounded py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    <button type="submit" className="w-full bg-yellow-500 text-white py-3 rounded font-black shadow-lg hover:bg-yellow-600">RESET PASSWORD</button>
                  </form>
                  <button onClick={() => { setShowForgot(false); setForgotMsg(''); }} className="w-full text-center mt-4 text-slate-500 font-bold text-sm hover:underline">← Back to Login</button>
                </div>
              ) : (
                <form onSubmit={handleLogin} className="space-y-4">
                  {isRegister && <input name="name" type="text" required placeholder="Full Name" className="w-full bg-[#f0f5ff] border-none rounded py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500" />}
                  <input name="username" type="text" required placeholder="Username" className="w-full bg-[#f0f5ff] border-none rounded py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  {isRegister && <input name="email" type="email" placeholder="Email" className="w-full bg-[#f0f5ff] border-none rounded py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500" />}
                  {isRegister && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 flex items-center gap-1"><i className="fa-solid fa-image text-blue-400"></i> Profile Photo <span className="text-slate-400 font-normal">(optional)</span></label>
                      <div className="flex items-center gap-3">
                        {regImageData
                          ? <img src={regImageData} alt="preview" className="w-12 h-12 rounded-full object-cover border-2 border-blue-300" />
                          : <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-300"><i className="fa-solid fa-user text-xl"></i></div>
                        }
                        <label className="cursor-pointer bg-[#f0f5ff] border border-slate-200 text-slate-600 px-3 py-2 rounded text-xs font-bold hover:bg-blue-50 transition-colors">
                          {regImageData ? 'Change Photo' : 'Upload Photo'}
                          <input type="file" accept="image/*" className="hidden" onChange={e => {
                            const f = e.target.files?.[0]; if (!f) return;
                            const r = new FileReader();
                            r.onload = ev => setRegImageData(ev.target?.result as string);
                            r.readAsDataURL(f);
                          }} />
                        </label>
                        {regImageData && (
                          <button type="button" disabled={regDetecting} onClick={() => handleDetectRegSkinTone(regImageData)}
                            className="bg-purple-600 text-white px-3 py-2 rounded text-xs font-bold hover:bg-purple-700 transition-colors disabled:opacity-60 flex items-center gap-1">
                            {regDetecting ? <><i className="fa-solid fa-spinner fa-spin"></i> Detecting…</> : <><i className="fa-solid fa-palette"></i> Detect Tone</>}
                          </button>
                        )}
                      </div>
                      {regSkinTone && (
                        <div className="flex items-center gap-2 bg-purple-50 border border-purple-100 rounded px-3 py-2">
                          <span className="w-4 h-4 rounded-full border border-white shadow" style={{ backgroundColor: SKIN_TONES.find(s => s.label === regSkinTone)?.color || '#ccc' }}></span>
                          <span className="text-xs font-bold text-purple-800">Skin tone: {regSkinTone}</span>
                          <button type="button" onClick={() => setRegSkinTone('')} className="ml-auto text-purple-400 hover:text-purple-600 text-xs"><i className="fa-solid fa-xmark"></i></button>
                        </div>
                      )}
                    </div>
                  )}
                  <input name="password" type="password" required placeholder="Password" className="w-full bg-[#f0f5ff] border-none rounded py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  {!isRegister && (
                    <div className="text-right">
                      <button type="button" onClick={() => { setShowForgot(true); setAuthError(''); }} className="text-xs text-[#2874f0] font-bold hover:underline">Forgot Password?</button>
                    </div>
                  )}
                  <button type="submit" className="w-full bg-[#fb641b] text-white py-3 rounded font-black text-lg shadow-lg hover:bg-[#e65a15] transition-all">{isRegister ? 'CREATE ACCOUNT' : 'SIGN IN'}</button>
                </form>
              )}
              {!showForgot && (
                <div className="text-center mt-6">
                  <button onClick={() => { setIsRegister(!isRegister); setAuthError(''); }} className="text-[#2874f0] font-bold text-sm hover:underline">
                    {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Register"}
                  </button>
                </div>
              )}
              <div className="mt-4 text-center text-xs text-slate-400">
                <p className="font-medium">Admin: <span className="text-slate-600 font-bold">admin / admin123</span> &nbsp;|&nbsp; Demo: <span className="text-slate-600 font-bold">riya / riya123</span></p>
              </div>
            </div>
          </div>
        )}

        {/* HOME VIEW */}
        {view === 'home' && (
          <div className="animate-fade-in">
            {/* Carousel Banner Section */}
            <section className="container mx-auto px-4 mt-4 relative">
              <div className={`h-[280px] md:h-[420px] rounded-lg overflow-hidden relative shadow-lg ${heroBanners[currentHero].bg} transition-all duration-700`}>
                <img src={heroBanners[currentHero].img} className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-50" />
                <div className="absolute inset-0 flex flex-col justify-center px-8 md:px-20 text-white space-y-2 md:space-y-4">
                  <span className="bg-[#ffc200] text-slate-900 px-3 py-1 rounded text-[10px] font-black w-fit uppercase">{heroBanners[currentHero].tag}</span>
                  <h1 className="text-3xl md:text-6xl font-black leading-tight drop-shadow-lg">{heroBanners[currentHero].title}</h1>
                  <p className="text-lg md:text-2xl font-bold opacity-90">{heroBanners[currentHero].sub}</p>
                  <button onClick={() => setView('shop')} className="bg-white text-blue-600 px-8 py-3 rounded w-fit font-black shadow-xl hover:scale-105 transition-transform mt-4">SHOP NOW</button>
                </div>
                {/* Dots */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {heroBanners.map((_, i) => (
                    <div key={i} className={`dot ${currentHero === i ? 'dot-active' : 'bg-white/40'}`}></div>
                  ))}
                </div>
              </div>
            </section>

            {/* Featured Section - Deails on Everything */}
            <section className="container mx-auto px-4 mt-8">
              <div className="bg-white p-4 md:p-6 rounded-lg shadow-sm">
                <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-xl md:text-2xl font-black text-slate-800">Best Deals for You</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Refined for 2026</p>
                  </div>
                  <button onClick={() => setView('shop')} className="bg-[#2874f0] text-white px-5 py-2 rounded text-xs font-black shadow-md">VIEW ALL</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {products.slice(0, 5).map(p => (
                    <ProductCard key={p.id} product={p} onAddToCart={addToCart} onNavigate={setView} onProductClick={openProductDetail} onShare={user ? setShareModalProduct : undefined} onAnalyze={user ? setAnalyzerProduct : undefined} />
                  ))}
                </div>
              </div>
            </section>

            {/* Occasion Recommendations */}
            {occasions.map(occ => {
              const occProds = products.filter(p => occ.productIds.includes(p.id));
              if (occProds.length === 0) return null;
              return (
                <section key={occ.id} className="container mx-auto px-4 mt-8">
                  <div className="bg-white p-4 md:p-6 rounded-lg shadow-sm">
                    <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        {occ.tag && (
                          <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-wide border border-amber-200 shrink-0">
                            {occ.tag}
                          </span>
                        )}
                        <div>
                          <h2 className="text-xl md:text-2xl font-black text-slate-800">{occ.name}</h2>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">{occProds.length} curated picks</p>
                        </div>
                      </div>
                      <button onClick={() => setView('shop')} className="bg-[#2874f0] text-white px-5 py-2 rounded text-xs font-black shadow-md shrink-0">VIEW ALL</button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {occProds.slice(0, 5).map(p => (
                        <ProductCard key={p.id} product={p} onAddToCart={addToCart} onNavigate={setView} onProductClick={openProductDetail} onShare={user ? setShareModalProduct : undefined} onAnalyze={user ? setAnalyzerProduct : undefined} />
                      ))}
                    </div>
                  </div>
                </section>
              );
            })}

            {/* Secondary Hero Sections */}
            <section className="container mx-auto px-4 mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 pb-12">
              <div className="bg-[#fff1f1] p-8 rounded-lg border border-red-100 flex flex-col justify-between h-[200px] shadow-sm cursor-pointer group" onClick={() => { setSelectedCategory('Lipsticks'); setView('shop'); }}>
                <div>
                  <h3 className="text-2xl font-black text-red-600">Beauty Store</h3>
                  <p className="text-sm font-bold text-slate-500 mt-2">Premium collections start ₹299</p>
                </div>
                <span className="text-xs font-black text-red-600 group-hover:underline">EXPLORE NOW →</span>
              </div>
              <div className="bg-[#f0f5ff] p-8 rounded-lg border border-blue-100 flex flex-col justify-between h-[200px] shadow-sm cursor-pointer group" onClick={() => { setSelectedCategory('Shoes'); setView('shop'); }}>
                <div>
                  <h3 className="text-2xl font-black text-blue-600">Sneaker Hub</h3>
                  <p className="text-sm font-bold text-slate-500 mt-2">Top brands at huge discounts</p>
                </div>
                <span className="text-xs font-black text-blue-600 group-hover:underline">EXPLORE NOW →</span>
              </div>
              <div className="bg-[#f8fcf0] p-8 rounded-lg border border-green-100 flex flex-col justify-between h-[200px] shadow-sm cursor-pointer group" onClick={() => { setSelectedCategory('Jackets'); setView('shop'); }}>
                <div>
                  <h3 className="text-2xl font-black text-green-600">Winter Wear</h3>
                  <p className="text-sm font-bold text-slate-500 mt-2">Maverick designs for 2026</p>
                </div>
                <span className="text-xs font-black text-green-600 group-hover:underline">EXPLORE NOW →</span>
              </div>
            </section>
          </div>
        )}

        {/* SHOP VIEW */}
        {view === 'shop' && (
          <div className="container mx-auto px-4 py-8 space-y-8 animate-fade-in">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100 flex flex-col md:flex-row gap-6 items-center justify-between">
              <div>
                <h2 className="text-3xl font-black text-slate-800">Shop Our Collections</h2>
                <p className="text-sm text-slate-400 mt-1">Showing results for <span className="text-blue-600 font-bold">{selectedCategory}</span></p>
              </div>
              <div className="flex gap-2">
                <select
                  value={selectedCategory}
                  onChange={e => { setSelectedCategory(e.target.value); setSelectedSubcategory('All'); }}
                  className="bg-slate-50 border border-slate-200 px-4 py-2 rounded text-sm font-bold outline-none"
                >
                  {['All', ...categories.map(c => c.name)].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {selectedCategory !== 'All' && categories.find(c => c.name === selectedCategory)?.subcategories?.length! > 0 && (
                  <select
                    value={selectedSubcategory}
                    onChange={e => setSelectedSubcategory(e.target.value)}
                    className="bg-slate-50 border border-slate-200 px-4 py-2 rounded text-sm font-bold outline-none italic"
                  >
                    <option value="All">All {selectedCategory}</option>
                    {categories.find(c => c.name === selectedCategory)?.subcategories.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {filteredProducts.map(p => <ProductCard key={p.id} product={p} onAddToCart={addToCart} onNavigate={setView} onProductClick={openProductDetail} onShare={user ? setShareModalProduct : undefined} onAnalyze={user ? setAnalyzerProduct : undefined} />)}
            </div>
          </div>
        )}

        {/* CART VIEW */}
        {view === 'cart' && (
          <div className="container mx-auto px-4 py-12 animate-fade-in">
            <h2 className="text-3xl font-black text-slate-800 mb-8">My Shopping Cart ({cart.length})</h2>
            {cart.length === 0 ? (
              <div className="bg-white p-20 text-center rounded-lg shadow-sm">
                <i className="fa-solid fa-cart-shopping text-6xl text-slate-200 mb-6"></i>
                <h3 className="text-xl font-bold text-slate-400 mb-6">Your cart is empty!</h3>
                <button onClick={() => setView('shop')} className="bg-[#2874f0] text-white px-10 py-3 rounded font-black shadow-lg">SHOP NOW</button>
              </div>
            ) : (
              <div className="grid lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2 space-y-4">
                  {cart.map(item => (
                    <div key={item.product.id} className="bg-white p-6 rounded-lg shadow-sm border border-slate-100 flex gap-6">
                      <img src={item.product.image} className="w-24 h-24 object-cover rounded-md" alt={item.product.name} />
                      <div className="flex-grow">
                        <h4 className="font-bold text-slate-800 text-lg mb-1">{item.product.name}</h4>
                        <p className="text-blue-600 font-black mb-4">{formatINR(item.product.price)}</p>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center bg-slate-100 rounded p-1">
                            <button onClick={() => updateCartQty(item.product.id, Math.max(1, item.quantity - 1))} className="w-8 h-8 rounded hover:bg-white transition-all">-</button>
                            <span className="w-10 text-center font-bold">{item.quantity}</span>
                            <button onClick={() => updateCartQty(item.product.id, item.quantity + 1)} className="w-8 h-8 rounded hover:bg-white transition-all">+</button>
                          </div>
                          <button onClick={() => removeCartItem(item.product.id)} className="text-rose-500 font-bold hover:underline text-sm uppercase tracking-widest">Remove</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-white p-6 rounded-lg shadow-lg border border-slate-100 space-y-6 sticky top-24">
                  <h3 className="text-xl font-black border-b pb-4 uppercase tracking-tighter text-slate-400">Price Details</h3>
                  <div className="space-y-4 font-medium text-slate-600">
                    <div className="flex justify-between"><span>Price ({cart.length} items)</span><span>{formatINR(cart.reduce((a, b) => a + (b.product.price * b.quantity), 0))}</span></div>
                    <div className="flex justify-between"><span>Delivery Charges</span><span className="text-green-600">FREE</span></div>
                    <div className="flex justify-between"><span>Secured Packaging Fee</span><span>₹29</span></div>
                  </div>
                  <div className="border-t border-dashed pt-4 flex justify-between font-black text-2xl text-slate-800">
                    <span>Total Amount</span>
                    <span>{formatINR(cart.reduce((a, b) => a + (b.product.price * b.quantity), 0) + 29)}</span>
                  </div>
                  <button onClick={handleCheckout} className="w-full bg-[#fb641b] text-white py-4 rounded font-black text-xl shadow-xl hover:bg-[#e65a15] transition-all">PLACE ORDER</button>
                </div>
              </div>
            )}

            {/* PURCHASE HISTORY */}
            {user && orders.length > 0 && (
              <div className="mt-12">
                <h2 className="text-3xl font-black text-slate-800 mb-8 flex items-center gap-3">
                  <i className="fa-solid fa-clock-rotate-left text-indigo-500"></i> Purchase History
                </h2>
                <div className="space-y-6">
                  {orders.map(order => (
                    <div key={order.id} className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
                      <div className="flex flex-wrap justify-between items-center mb-4 pb-4 border-b border-slate-100">
                        <div>
                          <p className="text-sm font-black text-slate-800">{order.id}</p>
                          <p className="text-xs text-slate-400 mt-1"><i className="fa-solid fa-calendar mr-1"></i>{new Date(order.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="bg-green-100 text-green-700 text-[10px] font-black px-3 py-1 rounded-full uppercase"><i className="fa-solid fa-check-circle mr-1"></i>Confirmed</span>
                          <span className="text-lg font-black text-slate-800">{formatINR(order.total)}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg">
                            {item.product.image && (
                              <img
                                src={item.product.image}
                                className="w-12 h-12 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                                alt={item.product.name}
                                onClick={() => openProductDetail(item.product)}
                              />
                            )}
                            <div className="flex-grow min-w-0">
                              <p className="font-bold text-sm text-slate-800 truncate">{item.product.name}</p>
                              <p className="text-xs text-slate-400">{formatINR(item.product.price)} × {item.quantity}</p>
                              {user && (
                                <button
                                  onClick={() => {
                                    setReviewTarget({ productId: item.product.id, productName: item.product.name });
                                    setReviewModalOpen(true);
                                  }}
                                  className="mt-1.5 flex items-center gap-1 text-[10px] font-black uppercase text-blue-600 hover:text-blue-800 transition-colors"
                                >
                                  <i className="fa-solid fa-star text-yellow-400" /> Rate &amp; Review
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TRIAL VIEW */}
        {view === 'trial' && (
          <div className="container mx-auto px-4 py-20 animate-fade-in">
            <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 relative min-h-[500px] flex items-center justify-center text-center p-12">
              <div className="relative z-10 space-y-6">
                <div className="w-24 h-24 bg-indigo-500 text-white rounded-3xl flex items-center justify-center text-4xl mx-auto shadow-2xl animate-pulse">
                  <i className="fa-solid fa-camera"></i>
                </div>
                <h2 className="text-5xl font-black text-slate-800 tracking-tighter leading-none">VIRTUAL TRIAL <br /> <span className="text-indigo-600">BETA 2026</span></h2>
                <p className="text-xl text-slate-400 font-medium max-w-lg mx-auto leading-relaxed">
                  Try on your favorite Sunglasses and Lipsticks virtually. We are currently finalizing the AI depth sensor integration.
                </p>
                <div className="flex flex-wrap justify-center gap-4 pt-8">
                  <div className="bg-slate-50 p-6 rounded-2xl w-40 border border-slate-100 shadow-sm">
                    <i className="fa-solid fa-glasses text-2xl text-indigo-500 mb-2"></i>
                    <p className="text-[10px] font-black uppercase text-slate-500">Eyewear AR</p>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-2xl w-40 border-2 border-indigo-200 shadow-sm scale-110">
                    <i className="fa-solid fa-robot text-2xl text-indigo-600 mb-2"></i>
                    <p className="text-[10px] font-black uppercase text-indigo-600">AI Active</p>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-2xl w-40 border border-slate-100 shadow-sm">
                    <i className="fa-solid fa-vest text-2xl text-indigo-500 mb-2"></i>
                    <p className="text-[10px] font-black uppercase text-slate-500">Fabrics AR</p>
                  </div>
                </div>
                <button onClick={() => setView('shop')} className="mt-12 bg-slate-900 text-white px-10 py-4 rounded-xl font-black text-lg shadow-xl hover:scale-105 transition-all">BACK TO SHOP</button>
              </div>
              {/* Decorative gradients */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-100 rounded-full blur-[100px] opacity-40 -translate-y-1/2"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-100 rounded-full blur-[100px] opacity-40 translate-y-1/2"></div>
            </div>
          </div>
        )}

        {/* ADMIN DASHBOARD */}
        {view === 'admin' && user?.role === 'admin' && (
          <div className="container mx-auto px-4 py-12 animate-fade-in">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-4xl font-black text-slate-800 tracking-tight">Admin Dashboard</h2>
              <div className="flex gap-4">
                <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 flex items-center gap-4">
                  <div className="bg-blue-100 text-blue-600 w-10 h-10 rounded-full flex items-center justify-center text-xl"><i className="fa-solid fa-database"></i></div>
                  <div><p className="text-[10px] font-black uppercase text-slate-400">Backend</p><p className="font-bold text-green-600">Connected</p></div>
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                {/* MANAGE CATEGORIES */}
                <div className="bg-white p-8 rounded-lg shadow-lg border border-slate-100">
                  <h3 className="text-xl font-black mb-6 flex items-center gap-2"><i className="fa-solid fa-tags text-purple-600"></i> Manage Categories & Subcategories</h3>

                  {/* Categories list */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                    {categories.map(cat => (
                      <div key={cat.code} className={`flex flex-col rounded-2xl border-2 transition-all overflow-hidden ${viewingSubcatFor === cat.code ? 'border-purple-500 shadow-xl ring-4 ring-purple-50' : 'border-slate-100 hover:border-purple-200'}`}>
                        <div className="bg-white p-4 flex items-center gap-4 cursor-pointer" onClick={() => setViewingSubcatFor(viewingSubcatFor === cat.code ? null : cat.code)}>
                          <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center overflow-hidden border border-slate-100">
                            <img src={cat.logoUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${cat.name}`} alt={cat.name} className="w-8 h-8 object-contain" />
                          </div>
                          <div className="flex-grow">
                            <p className="font-black text-slate-800 leading-none">{cat.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{(cat as any).subcategories?.length || 0} subcategories</p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              showConfirm("Delete Category?", `Are you sure you want to delete "${cat.name}"? Products won't be deleted but will lose this category tag.`, async () => {
                                await api.del(`/categories/${cat.code}`);
                                loadCategories();
                              });
                            }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-all"
                          >
                            <i className="fa-solid fa-trash-can text-sm"></i>
                          </button>
                        </div>

                        {viewingSubcatFor === cat.code && (
                          <div className="bg-purple-50/50 p-4 border-t border-purple-100 animate-slide-down">
                            <p className="text-[10px] font-black uppercase text-purple-400 mb-3 tracking-widest flex items-center gap-2">
                              <i className="fa-solid fa-list-ul"></i> Subcategories
                            </p>
                            <div className="flex flex-wrap gap-2 mb-4">
                              {(cat as any).subcategories?.map((sub: string) => (
                                <div key={sub} className="flex items-center gap-2 bg-white border border-purple-200 rounded-full px-3 py-1 shadow-sm group">
                                  <span className="text-xs font-bold text-purple-700">{sub}</span>
                                  <button
                                    onClick={() => {
                                      showConfirm("Remove Subcategory?", `Remove "${sub}" from ${cat.name}?`, async () => {
                                        await api.del(`/categories/${cat.code}/subcategories/${sub}`);
                                        loadCategories();
                                      });
                                    }}
                                    className="text-purple-300 hover:text-rose-500 transition-colors"
                                  >
                                    <i className="fa-solid fa-circle-xmark text-xs"></i>
                                  </button>
                                </div>
                              ))}
                              {(!(cat as any).subcategories || (cat as any).subcategories.length === 0) && (
                                <p className="text-[10px] text-slate-400 italic font-medium py-1">No subcategories added yet.</p>
                              )}
                            </div>

                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={newSubcatName}
                                onChange={e => setNewSubcatName(e.target.value)}
                                placeholder="Add subcategory..."
                                className="flex-grow bg-white border border-purple-100 rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-purple-200 transition-all"
                              />
                              <button
                                disabled={!newSubcatName.trim()}
                                onClick={async () => {
                                  await api.post(`/categories/${cat.code}/subcategories`, { name: newSubcatName.trim() });
                                  setNewSubcatName('');
                                  loadCategories();
                                }}
                                className="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black shadow hover:bg-purple-700 transition-all disabled:opacity-50"
                              >
                                ADD
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newCatName.trim()) return;
                    setNewCatLoading(true);
                    try {
                      const fd = new FormData();
                      fd.append('name', newCatName.trim());
                      if (newCatFile) fd.append('logo', newCatFile);
                      const res = await api.upload('/categories', fd);
                      if (res.error) { alert(res.error); } else {
                        setNewCatName('');
                        setNewCatFile(null);
                        setNewCatPreview('');
                        loadCategories();
                      }
                    } catch { alert('Failed to add category'); }
                    setNewCatLoading(false);
                  }} className="border-3 border-dashed border-purple-200 rounded-2xl p-6 bg-slate-50/50 hover:bg-white hover:border-purple-400 transition-all">
                    <p className="text-xs font-black text-purple-600 mb-5 uppercase tracking-[0.2em] flex items-center gap-2">
                      <i className="fa-solid fa-circle-plus"></i> Create New Main Category
                    </p>
                    <div className="flex flex-col sm:flex-row gap-6 items-center">
                      <label className="cursor-pointer group relative shrink-0">
                        <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden transition group-hover:border-purple-500 shadow-sm">
                          {newCatPreview
                            ? <img src={newCatPreview} alt="preview" className="w-full h-full object-cover" />
                            : <div className="text-center"><i className="fa-solid fa-cloud-arrow-up text-2xl text-slate-300 group-hover:text-purple-400"></i><p className="text-[8px] font-black text-slate-400 uppercase mt-1">Logo</p></div>
                          }
                        </div>
                        <input type="file" accept="image/*" className="hidden" onChange={e => {
                          const f = e.target.files?.[0]; if (!f) return;
                          setNewCatFile(f);
                          const r = new FileReader();
                          r.onload = d => setNewCatPreview(d.target?.result as string);
                          r.readAsDataURL(f);
                        }} />
                      </label>
                      <div className="flex-grow w-full space-y-4">
                        <input
                          type="text"
                          value={newCatName}
                          onChange={e => setNewCatName(e.target.value)}
                          placeholder="What's the category called? (e.g. Wellness)"
                          className="w-full bg-white border border-slate-200 rounded-xl py-3 px-5 text-sm font-bold outline-none focus:ring-4 focus:ring-purple-50 focus:border-purple-300 transition-all"
                        />
                        <button
                          type="submit"
                          disabled={newCatLoading || !newCatName.trim()}
                          className="w-full bg-purple-600 text-white py-3.5 rounded-xl font-black text-xs shadow-xl shadow-purple-100 hover:bg-purple-700 active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                          {newCatLoading ? <><i className="fa-solid fa-circle-notch fa-spin mr-2"></i>CRAFTING CATEGORY…</> : 'ESTABLISH NEW CATEGORY'}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>

                {/* OCCASION RECOMMENDATIONS */}
                <div className="bg-white p-8 rounded-lg shadow-lg border border-slate-100">
                  <h3 className="text-xl font-black mb-6 flex items-center gap-2"><i className="fa-solid fa-wand-magic-sparkles text-amber-500"></i> Occasion Recommendations</h3>

                  {/* Existing occasions */}
                  {occasions.length > 0 && (
                    <div className="space-y-3 mb-6">
                      {occasions.map(occ => {
                        const occProds = products.filter(p => occ.productIds.includes(p.id));
                        return (
                          <div key={occ.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 group">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-wrap">
                                {occ.tag && <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-3 py-1 rounded-full border border-amber-200">{occ.tag}</span>}
                                <span className="font-bold text-slate-800">{occ.name}</span>
                                <span className="text-xs text-slate-400">{occProds.length} product{occProds.length !== 1 ? 's' : ''}</span>
                              </div>
                              <button
                                onClick={() => {
                                  showConfirm("Delete Occasion?", `Are you sure you want to delete "${occ.name}"?`, async () => {
                                    await api.del(`/occasions/${occ.id}`);
                                    loadOccasions();
                                  });
                                }}
                                className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-600 text-sm transition-all ml-2"
                                title="Delete"
                              >
                                <i className="fa-solid fa-trash"></i>
                              </button>
                            </div>
                            {occProds.length > 0 && (
                              <div className="flex gap-2 mt-3 flex-wrap">
                                {occProds.map(p => (
                                  <div key={p.id} className="flex items-center gap-1.5 bg-white border border-slate-100 rounded-lg px-2 py-1">
                                    <img src={p.image} className="w-5 h-5 object-cover rounded" alt={p.name} />
                                    <span className="text-[10px] font-bold text-slate-600 max-w-[80px] truncate">{p.name}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add new occasion form */}
                  <div className="border border-dashed border-amber-300 rounded-xl p-5 bg-amber-50/30">
                    <p className="text-sm font-black text-amber-700 mb-4 uppercase tracking-wide"><i className="fa-solid fa-plus mr-2"></i>Add New Occasion</p>
                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <input
                        type="text"
                        value={newOccName}
                        onChange={e => setNewOccName(e.target.value)}
                        placeholder="Occasion name (e.g. Diwali Gift Guide)"
                        className="bg-white border border-slate-200 rounded-lg py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                      />
                      <input
                        type="text"
                        value={newOccTag}
                        onChange={e => setNewOccTag(e.target.value)}
                        placeholder="Side tag (e.g. 🎉 Festival Special)"
                        className="bg-white border border-slate-200 rounded-lg py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                      />
                    </div>
                    <p className="text-xs font-black text-slate-500 uppercase tracking-wide mb-3">Select Products</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto bg-white border border-slate-100 rounded-xl p-3 mb-4">
                      {products.map(p => (
                        <label key={p.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all border ${newOccProductIds.includes(p.id) ? 'bg-amber-50 border-amber-300' : 'border-transparent hover:bg-slate-50'}`}>
                          <input
                            type="checkbox"
                            checked={newOccProductIds.includes(p.id)}
                            onChange={e => setNewOccProductIds(prev => e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id))}
                            className="accent-amber-500 shrink-0"
                          />
                          <img src={p.image} className="w-8 h-8 object-cover rounded-md shrink-0" alt={p.name} />
                          <span className="text-[11px] font-bold text-slate-700 line-clamp-2">{p.name}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs text-amber-600 font-bold">{newOccProductIds.length} product{newOccProductIds.length !== 1 ? 's' : ''} selected</span>
                      <button
                        disabled={!newOccName.trim() || newOccProductIds.length === 0 || newOccLoading}
                        onClick={async () => {
                          if (!newOccName.trim() || newOccProductIds.length === 0) return;
                          setNewOccLoading(true);
                          try {
                            const res = await api.post('/occasions', { name: newOccName.trim(), tag: newOccTag.trim(), productIds: newOccProductIds });
                            if (res.error) { alert(res.error); } else {
                              setNewOccName(''); setNewOccTag(''); setNewOccProductIds([]);
                              loadOccasions();
                            }
                          } catch { alert('Failed to create occasion'); }
                          setNewOccLoading(false);
                        }}
                        className="bg-amber-500 text-white py-3 px-8 rounded-lg font-black text-sm shadow hover:bg-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {newOccLoading ? <><i className="fa-solid fa-spinner fa-spin mr-2"></i>Saving…</> : <><i className="fa-solid fa-plus mr-2"></i>Create Occasion</>}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-lg shadow-lg border border-slate-100">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black flex items-center gap-2 text-rose-600"><i className="fa-solid fa-boxes-stacked"></i> Inventory & Stock Alerts</h3>
                    {products.filter(p => !p.stock || p.stock <= 5).length > 0 && (
                      <button
                        onClick={async () => {
                          await api.post('/products/restock-all', { amount: 10, lowOnly: true });
                          loadProducts();
                        }}
                        className="bg-rose-100 text-rose-600 px-4 py-2 rounded-xl font-black text-xs hover:bg-rose-200 transition-all flex items-center gap-2 border border-rose-200"
                      >
                        <i className="fa-solid fa-bolt"></i> RESTOCK ALL LOW ITEMS (+10)
                      </button>
                    )}
                  </div>
                  <div className="space-y-4">
                    {products.filter(p => !p.stock || p.stock <= 5).map(p => (
                      <div key={p.id} className="flex items-center justify-between p-4 bg-rose-50 border border-rose-100 rounded-2xl animate-pulse-subtle">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-rose-200">
                            <img src={p.image} className="w-full h-full object-cover" alt="" />
                          </div>
                          <div>
                            <p className="font-black text-rose-900 leading-none">{p.name}</p>
                            <p className="text-[10px] text-rose-500 font-bold uppercase mt-1 tracking-widest">{p.stock === 0 ? 'Out of Stock' : `Low Stock: ${p.stock} left`}</p>
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            await api.post(`/products/${p.id}/restock`, { amount: 10 });
                            loadProducts();
                          }}
                          className="bg-rose-500 text-white px-5 py-2 rounded-xl font-black text-xs shadow-lg shadow-rose-200 hover:bg-rose-600 active:scale-95 transition-all"
                        >
                          RESTOCK +10
                        </button>
                      </div>
                    ))}
                    {products.filter(p => !p.stock || p.stock <= 5).length === 0 && (
                      <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <i className="fa-solid fa-circle-check text-4xl text-emerald-400 mb-2"></i>
                        <p className="text-sm font-bold text-slate-400 italic">All shelves are perfectly stocked.</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-8">
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-[0.3em]">Full Inventory List</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                      {products.sort((a, b) => (a.stock || 0) - (b.stock || 0)).map(p => (
                        <div key={p.id} className="bg-white border border-slate-100 p-4 rounded-2xl flex items-center justify-between hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-50 transition-all group">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`w-2.5 h-2.5 rounded-full shadow-sm ${(p.stock || 0) > 10 ? 'bg-emerald-400' : (p.stock || 0) > 5 ? 'bg-amber-400' : 'bg-rose-500 animate-pulse'}`}></span>
                            <div className="min-w-0">
                              <p className="text-[11px] font-black text-slate-800 truncate mb-0.5">{p.name}</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{p.category} {p.subcategory ? `· ${p.subcategory}` : ''}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[10px] font-black text-slate-500 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 italic">Qty: {p.stock || 0}</span>
                            <button
                              onClick={() => {
                                showConfirm("Delete Product?", `Are you sure you want to delete ${p.name}?`, async () => {
                                  await api.del(`/products/${p.id}`);
                                  loadProducts();
                                });
                              }}
                              className="w-8 h-8 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                              title="Permanently Delete Product"
                            >
                              <i className="fa-solid fa-trash-can text-xs"></i>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ADD PRODUCT FORM */}
                <div className="bg-white p-8 rounded-lg shadow-lg border border-slate-100">
                  <h3 className="text-xl font-black mb-6 flex items-center gap-2"><i className="fa-solid fa-circle-plus text-blue-600"></i> Add New Product</h3>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const fd = new FormData(form);
                    try {
                      const res = await api.upload('/products', fd);
                      if (res.error) { alert(res.error); return; }
                      alert(`Product "${res.name}" created!`);
                      form.reset();
                      loadProducts();
                    } catch { alert('Failed to create product'); }
                  }} className="grid md:grid-cols-2 gap-6" encType="multipart/form-data">
                    <input name="name" type="text" required placeholder="Product Name" className="w-full bg-[#f0f5ff] rounded py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    <select
                      name="category"
                      value={newProdCat}
                      onChange={e => setNewProdCat(e.target.value)}
                      className="w-full bg-[#f0f5ff] rounded py-3 px-4 text-sm outline-none appearance-none font-bold text-slate-700"
                    >
                      <option value="">Select Category</option>
                      {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                    <select name="subcategory" className="w-full bg-[#f0f5ff] rounded py-3 px-4 text-sm outline-none appearance-none font-bold text-slate-700 italic">
                      <option value="">No Subcategory</option>
                      {categories.find(c => c.name === newProdCat)?.subcategories?.map((s: string) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <input name="price" type="number" required placeholder="Price (₹)" className="w-full bg-[#f0f5ff] rounded py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    <input name="rating" type="number" step="0.1" min="1" max="5" placeholder="Rating (1-5)" defaultValue="4.5" className="w-full bg-[#f0f5ff] rounded py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    <input name="stock" type="number" required placeholder="Initial Stock Qty" defaultValue="10" className="w-full bg-[#f0f5ff] rounded py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-slate-600 mb-2"><i className="fa-solid fa-images text-blue-500 mr-2"></i>Product Images (upload multiple)</label>
                      <input name="images" type="file" accept="image/*" multiple className="w-full bg-[#f0f5ff] rounded py-3 px-4 text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-bold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200" />
                    </div>
                    <textarea name="description" placeholder="Product Description" className="w-full bg-[#f0f5ff] rounded py-3 px-4 text-sm h-32 md:col-span-2 outline-none focus:ring-2 focus:ring-blue-500" />
                    <button type="submit" className="bg-blue-600 text-white py-4 rounded font-black md:col-span-2 shadow-xl hover:bg-blue-700 transition-all"><i className="fa-solid fa-upload mr-2"></i>PUBLISH PRODUCT</button>
                  </form>
                </div>

                {/* PRODUCT LIST */}
                <div className="bg-white p-8 rounded-lg shadow-lg border border-slate-100">
                  <h3 className="text-xl font-black mb-6 flex items-center gap-2"><i className="fa-solid fa-boxes-stacked text-indigo-600"></i> All Products ({products.length})</h3>
                  <div className="space-y-4 max-h-[500px] overflow-y-auto">
                    {products.map(p => (
                      <div key={p.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100 group">
                        <img src={p.image} className="w-16 h-16 object-cover rounded-lg" alt={p.name} />
                        <div className="flex-grow">
                          <p className="font-bold text-slate-800">{p.name}</p>
                          <p className="text-xs text-slate-400"><span className="text-blue-600 font-bold">{formatINR(p.price)}</span> · {p.category} · ⭐ {p.rating}</p>
                          {(p as any).images && (p as any).images.length > 1 && <p className="text-[10px] text-indigo-500 font-bold mt-1"><i className="fa-solid fa-images mr-1"></i>{(p as any).images.length} images</p>}
                        </div>
                        <button onClick={async () => { if (confirm(`Delete "${p.name}"?`)) { await api.del(`/products/${p.id}`); loadProducts(); } }} className="opacity-0 group-hover:opacity-100 bg-rose-100 text-rose-600 px-3 py-2 rounded text-xs font-bold hover:bg-rose-200 transition-all">
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ORDERS — ALL USERS */}
                <div className="bg-white p-8 rounded-lg shadow-lg border border-slate-100">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-black flex items-center gap-2"><i className="fa-solid fa-bag-shopping text-rose-600"></i> All Orders ({allAdminOrders.length})</h3>
                    <button onClick={loadAllOrders} className="text-xs font-black text-blue-600 hover:underline flex items-center gap-1"><i className="fa-solid fa-rotate-right"></i> Refresh</button>
                  </div>
                  {allAdminOrders.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-8">No orders placed yet.</p>
                  ) : (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
                      {allAdminOrders.map((o: any) => (
                        <div key={o.id} className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              {o.avatar && <img src={o.avatar} className="w-7 h-7 rounded-full border border-slate-200" alt={o.username} />}
                              <div>
                                <span className="font-black text-sm text-slate-800">{o.name || o.username}</span>
                                <span className="text-[10px] text-slate-400 ml-1.5">@{o.username}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black bg-green-100 text-green-700 px-2 py-0.5 rounded-full uppercase">{o.status || 'Confirmed'}</span>
                              <span className="text-xs font-black text-blue-600">{formatINR(o.total)}</span>
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-400 mb-2 font-mono">{o.id} · {new Date(o.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                          <div className="flex gap-2 flex-wrap">
                            {o.items?.map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-1.5 bg-white border border-slate-100 rounded-lg px-2 py-1">
                                {item.image && <img src={item.image} className="w-6 h-6 object-cover rounded" alt={item.name} />}
                                <span className="text-[10px] font-bold text-slate-700">{item.name}</span>
                                <span className="text-[10px] text-slate-400">×{item.quantity}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* USER MANAGEMENT */}
                <div className="bg-white p-8 rounded-lg shadow-lg border border-slate-100">
                  <h3 className="text-xl font-black mb-6 flex items-center gap-2"><i className="fa-solid fa-users text-emerald-600"></i> Registered Users ({allUsers.length})</h3>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {allUsers.map(u => (
                      <div key={u.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100 group">
                        <img src={u.avatar} className="w-10 h-10 rounded-full border" alt={u.username} />
                        <div className="flex-grow">
                          <p className="font-bold text-slate-800">{u.username} <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${u.role === 'admin' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>{u.role}</span></p>
                          <p className="text-xs text-slate-400">{u.email} · ID: {u.id}</p>
                        </div>
                        {u.role !== 'admin' && (
                          <button
                            onClick={() => handleDeleteUser(u.id, u.username)}
                            className="opacity-0 group-hover:opacity-100 bg-rose-100 text-rose-600 px-3 py-2 rounded text-xs font-bold hover:bg-rose-200 transition-all"
                          >
                            <i className="fa-solid fa-user-minus mr-1"></i>Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="bg-[#2874f0] p-10 rounded-lg shadow-2xl text-white">
                  <h4 className="text-xl font-black mb-10 opacity-70 uppercase tracking-widest text-sm">Real-time Performance</h4>
                  <div className="space-y-10">
                    <div className="flex justify-between items-end border-b border-white/10 pb-6">
                      <span className="text-sm font-bold opacity-80 uppercase tracking-widest">Total Products</span>
                      <span className="text-5xl font-black">{products.length}</span>
                    </div>
                    <div className="flex justify-between items-end border-b border-white/10 pb-6">
                      <span className="text-sm font-bold opacity-80 uppercase tracking-widest">Registered Users</span>
                      <span className="text-5xl font-black">{allUsers.length}</span>
                    </div>
                    <div className="flex justify-between items-end border-b border-white/10 pb-6">
                      <span className="text-sm font-bold opacity-80 uppercase tracking-widest">Orders (2026)</span>
                      <span className="text-5xl font-black">{allAdminOrders.length}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
                  <h4 className="text-xs font-black uppercase text-slate-400 mb-4 tracking-widest">Data Storage</h4>
                  <div className="space-y-2 text-sm text-slate-600">
                    <p className="flex items-center gap-2"><i className="fa-solid fa-file-code text-blue-500"></i> <span className="font-bold">users.json</span> — User accounts</p>
                    <p className="flex items-center gap-2"><i className="fa-solid fa-file-code text-green-500"></i> <span className="font-bold">products.json</span> — Product catalog</p>
                    <p className="flex items-center gap-2"><i className="fa-solid fa-file-code text-orange-500"></i> <span className="font-bold">cart.json</span> — Shopping carts</p>
                    <p className="flex items-center gap-2"><i className="fa-solid fa-folder-open text-purple-500"></i> <span className="font-bold">data/images/</span> — Product images</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ===== SOCIAL CHAT PANEL ===== */}
      {socialOpen && (
        <div className="fixed inset-0 z-[90] flex justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => { setSocialOpen(false); setActiveChatFriend(null); }} />

          {/* Panel */}
          <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-fade-in">
            {/* Header */}
            <div className="bg-[#2874f0] px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 text-white">
                <i className="fa-solid fa-users text-xl"></i>
                <div>
                  <p className="font-black text-lg leading-none">People</p>
                  <p className="text-[10px] opacity-70 uppercase tracking-widest">SmartShop Social</p>
                </div>
              </div>
              <button onClick={() => { setSocialOpen(false); setActiveChatFriend(null); }} className="text-white/80 hover:text-white text-xl"><i className="fa-solid fa-xmark"></i></button>
            </div>

            {/* Active Chat View */}
            {activeChatFriend ? (
              <div className="flex flex-col flex-grow min-h-0">
                {/* Chat Header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b bg-slate-50 shrink-0">
                  <button onClick={() => setActiveChatFriend(null)} className="text-blue-600 font-bold mr-1 hover:underline text-sm"><i className="fa-solid fa-arrow-left"></i></button>
                  <img src={activeChatFriend.avatar} className="w-9 h-9 rounded-full border border-slate-200" alt="" />
                  <div>
                    <p className="font-black text-slate-800 text-sm">{activeChatFriend.name || activeChatFriend.username}</p>
                    <p className="text-[10px] text-slate-400">@{activeChatFriend.username}</p>
                  </div>
                  <button onClick={() => setShowShareProduct(p => !p)} className="ml-auto bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 hover:bg-indigo-200">
                    <i className="fa-solid fa-share-nodes"></i> Share Product
                  </button>
                </div>

                {/* Product Picker (when sharing) */}
                {showShareProduct && (
                  <div className="px-3 py-2 bg-blue-50 border-b border-blue-100 shrink-0">
                    <p className="text-[10px] font-black uppercase text-blue-600 mb-2">Select a product to share</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {products.map(p => (
                        <button key={p.id} onClick={() => { sendSocialMessage(`Check out: ${p.name}`, 'product', p); setShowShareProduct(false); }}
                          className="shrink-0 flex flex-col items-center gap-1 bg-white rounded-lg p-2 border border-blue-100 hover:border-blue-400 w-20 transition-all">
                          <img src={p.image} className="w-12 h-12 object-cover rounded" alt={p.name} />
                          <span className="text-[9px] font-bold text-slate-700 text-center line-clamp-2 leading-tight">{p.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Messages */}
                <div className="flex-grow overflow-y-auto p-4 space-y-3 bg-[#f8f9fa]">
                  {socialMessages.length === 0 && (
                    <div className="text-center py-10 text-slate-400 text-sm">
                      <i className="fa-regular fa-comments text-4xl mb-3 block"></i>
                      Say hello to {activeChatFriend.name || activeChatFriend.username}!
                    </div>
                  )}
                  {socialMessages.map((msg: SocialMessage) => {
                    const isMe = msg.senderId === user?.id;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {msg.type === 'product' && msg.product ? (
                          <div className={`max-w-[80%] rounded-2xl overflow-hidden border shadow-sm ${isMe ? 'rounded-tr-none border-blue-200' : 'rounded-tl-none border-slate-200'}`}>
                            <div className={`px-3 py-1.5 text-[10px] font-black uppercase ${isMe ? 'bg-[#2874f0] text-white' : 'bg-slate-100 text-slate-500'}`}>
                              <i className="fa-solid fa-share-nodes mr-1"></i>Shared a product
                            </div>
                            <div className="bg-white p-3 flex gap-3 items-start">
                              <img src={(msg.product as any).images?.[0] || msg.product.image} className="w-16 h-16 object-cover rounded-lg shrink-0" alt={msg.product.name} />
                              <div>
                                <p className="font-black text-slate-800 text-sm line-clamp-2">{msg.product.name}</p>
                                <p className="text-blue-600 font-black text-sm mt-1">₹{msg.product.price.toLocaleString('en-IN')}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">{msg.product.category} · ⭐ {msg.product.rating}</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm font-medium shadow-sm ${isMe ? 'bg-[#2874f0] text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'}`}>
                            {msg.text}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div ref={socialChatEndRef} />
                </div>

                {/* Input */}
                <div className="p-3 border-t bg-white shrink-0">
                  <form onSubmit={e => { e.preventDefault(); if (socialInput.trim()) { sendSocialMessage(socialInput.trim()); setSocialInput(''); } }} className="flex gap-2 items-center">
                    <input
                      value={socialInput}
                      onChange={e => setSocialInput(e.target.value)}
                      type="text"
                      placeholder="Type a message..."
                      className="flex-grow bg-[#f0f5ff] px-4 py-3 rounded-xl outline-none text-sm"
                    />
                    <button type="submit" className="bg-[#2874f0] text-white w-11 h-11 rounded-xl flex items-center justify-center shadow hover:scale-105 transition-all">
                      <i className="fa-solid fa-paper-plane"></i>
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              // People / Friends / Requests tabs
              <div className="flex flex-col flex-grow min-h-0">
                {/* Tabs */}
                <div className="flex border-b shrink-0">
                  {(['people', 'friends', 'requests'] as const).map(tab => (
                    <button key={tab} onClick={() => setSocialTab(tab)}
                      className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-colors relative ${socialTab === tab ? 'text-[#2874f0] border-b-2 border-[#2874f0]' : 'text-slate-400 hover:text-slate-600'}`}>
                      {tab}
                      {tab === 'requests' && friendRequests.filter(r => r.status === 'pending').length > 0 && (
                        <span className="absolute top-2 right-2 bg-rose-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                          {friendRequests.filter(r => r.status === 'pending').length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex-grow overflow-y-auto">
                  {/* PEOPLE TAB */}
                  {socialTab === 'people' && (
                    <div className="p-4 space-y-3">
                      {socialUsers.length === 0 && (
                        <div className="text-center py-12 text-slate-400"><i className="fa-solid fa-users-slash text-3xl mb-3 block"></i>No users found</div>
                      )}
                      {socialUsers.filter(u => u.id !== user?.id).map((u: any) => {
                        const isFriend = friends.some(f => f.id === u.id);
                        const hasSent = friendRequests.some(r => r.fromId === user?.id && r.status === 'pending') || sentRequests.has(u.id);
                        const hasIncoming = friendRequests.some(r => r.fromId === u.id && r.status === 'pending');
                        return (
                          <div key={u.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-100 transition-all">
                            <img src={u.avatar} className="w-10 h-10 rounded-full border border-slate-200" alt="" />
                            <div className="flex-grow min-w-0">
                              <p className="font-black text-slate-800 text-sm truncate">{u.name || u.username}</p>
                              <p className="text-[11px] text-slate-400">@{u.username}</p>
                            </div>
                            {isFriend ? (
                              <button onClick={() => { setActiveChatFriend(u); loadConversation(u.id); }} className="bg-[#2874f0] text-white px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1">
                                <i className="fa-solid fa-message"></i> Chat
                              </button>
                            ) : hasIncoming ? (
                              <span className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg text-xs font-black">Pending ↓</span>
                            ) : hasSent ? (
                              <span className="bg-slate-100 text-slate-500 px-3 py-1.5 rounded-lg text-xs font-black">Sent ✓</span>
                            ) : (
                              <button onClick={() => sendFriendReq(u.id)} className="bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-black hover:bg-green-600 flex items-center gap-1">
                                <i className="fa-solid fa-user-plus"></i> Add
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* FRIENDS TAB */}
                  {socialTab === 'friends' && (
                    <div className="p-4 space-y-3">
                      {friends.length === 0 && (
                        <div className="text-center py-12 text-slate-400"><i className="fa-solid fa-user-group text-3xl mb-3 block"></i>No friends yet. Send requests in People tab!</div>
                      )}
                      {friends.map((f: any) => (
                        <div key={f.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <img src={f.avatar} className="w-10 h-10 rounded-full border border-green-200" alt="" />
                          <div className="flex-grow min-w-0">
                            <p className="font-black text-slate-800 text-sm">{f.name || f.username}</p>
                            <p className="text-[11px] text-green-500 font-bold flex items-center gap-1"><i className="fa-solid fa-circle text-[6px]"></i> Friend</p>
                          </div>
                          <button onClick={() => { setActiveChatFriend(f); loadConversation(f.id); setSocialTab('friends'); }} className="bg-[#2874f0] text-white px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1">
                            <i className="fa-solid fa-message"></i> Chat
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* REQUESTS TAB */}
                  {socialTab === 'requests' && (
                    <div className="p-4 space-y-3">
                      {friendRequests.filter(r => r.status === 'pending').length === 0 && (
                        <div className="text-center py-12 text-slate-400"><i className="fa-solid fa-bell text-3xl mb-3 block"></i>No pending requests</div>
                      )}
                      {friendRequests.filter(r => r.status === 'pending').map((r: FriendRequest) => (
                        <div key={r.id} className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
                          <img src={r.fromAvatar} className="w-10 h-10 rounded-full border border-amber-200" alt="" />
                          <div className="flex-grow min-w-0">
                            <p className="font-black text-slate-800 text-sm">{r.fromName}</p>
                            <p className="text-[10px] text-slate-400">Wants to be friends</p>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => respondToReq(r.id, 'accept')} className="bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-black hover:bg-green-600"><i className="fa-solid fa-check"></i></button>
                            <button onClick={() => respondToReq(r.id, 'decline')} className="bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-black hover:bg-rose-100 hover:text-rose-600"><i className="fa-solid fa-xmark"></i></button>
                          </div>
                        </div>
                      ))}
                      {/* Accepted list */}
                      {friendRequests.filter(r => r.status === 'accepted').length > 0 && (
                        <div className="mt-4">
                          <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Accepted</p>
                          {friendRequests.filter(r => r.status === 'accepted').map((r: FriendRequest) => (
                            <div key={r.id} className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-100 mb-2">
                              <img src={r.fromAvatar} className="w-8 h-8 rounded-full border border-green-200" alt="" />
                              <p className="font-black text-slate-700 text-sm">{r.fromName}</p>
                              <span className="ml-auto text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-black">Friends ✓</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUCCESS POPUP */}
      {showOrderSuccess && (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-2xl p-12 text-center animate-fade-in relative shadow-2xl">
            <div className="bg-green-100 text-green-600 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 text-5xl animate-bounce">
              <i className="fa-solid fa-check"></i>
            </div>
            <h2 className="text-5xl font-black text-slate-800 mb-2">Order Confirmed!</h2>
            <p className="text-xl text-slate-400 font-medium mb-12 italic">"Smart choice for a smart generation."</p>

            <div className="space-y-10">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.4em] flex items-center justify-center gap-4">
                <span className="h-px w-20 bg-slate-100"></span> AI RECOMENDED NEXT <span className="h-px w-20 bg-slate-100"></span>
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {products.slice(0, 4).map(p => (
                  <div key={p.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100 group cursor-pointer" onClick={() => setShowOrderSuccess(false)}>
                    <img src={p.image} className="aspect-square object-cover rounded-md mb-2 group-hover:scale-105 transition-transform" />
                    <p className="font-bold text-xs truncate">{p.name}</p>
                    <p className="text-[10px] font-black text-blue-600 mt-1">{formatINR(p.price)}</p>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={() => setShowOrderSuccess(false)} className="mt-16 bg-[#2874f0] text-white px-12 py-4 rounded font-black text-lg shadow-xl">CONTINUE SHOPPING</button>
          </div>
        </div>
      )}

      {/* NEW FEATURE MODALS */}
      {showCheckout && user && (
        <CheckoutModal
          cart={cart}
          user={user}
          addresses={userAddresses}
          total={cart.reduce((a, b) => a + (b.product.price * b.quantity), 0) + 29}
          onClose={() => setShowCheckout(false)}
          onAddAddress={async (addr) => {
            await api.post(`/address/${user.id}`, { address: addr });
            const data = await api.get(`/address/${user.id}`);
            setUserAddresses(Array.isArray(data) ? data : []);
          }}
          onPlaceOrder={async (addr, pMethod, tx) => {
            const cartItems = cart.map(item => ({ productId: item.product.id, quantity: item.quantity }));
            try {
              const res = await api.post(`/orders/${user.id}`, { items: cartItems, address: addr, paymentMethod: pMethod, transactionId: tx });
              if (res.error) { alert(res.error); return; }
              await loadOrders(user.id);
              await loadCart(user.id);
              setShowCheckout(false);
              setShowOrderSuccess(true);
            } catch { alert('Failed to place order'); }
          }}
        />
      )}

      {confirmData && (
        <ConfirmModal
          title={confirmData.title}
          message={confirmData.message}
          onConfirm={confirmData.onConfirm}
          onClose={() => setConfirmData(null)}
        />
      )}

      {/* PRODUCT DETAIL MODAL */}
      {productDetailOpen && selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          reviews={productReviews}
          canReview={!!(user && hasPurchased(selectedProduct.id))}
          onClose={() => { setProductDetailOpen(false); setSelectedProduct(null); setProductReviews([]); }}
          onAddToCart={addToCart}
          onTryAR={() => {
            // If it's the Thug Life product, pre-load its model
            const modelUrl = selectedProduct.name.toLowerCase().includes('thug life')
              ? '/api/models/thug_life__cool_glasses__stylise_goggles.glb'
              : undefined;
            setArModelUrl(modelUrl);
            setArOpen(true);
          }}
          onShare={user ? setShareModalProduct : undefined}
          onWriteReview={() => {
            setReviewTarget({ productId: selectedProduct.id, productName: selectedProduct.name });
            setReviewModalOpen(true);
          }}
        />
      )}

      {/* SHARE PRODUCT MODAL */}
      {shareModalProduct && user && (
        <ShareProductModal
          product={shareModalProduct}
          friends={friends}
          onShare={(friend) => shareProductToFriend(friend, shareModalProduct)}
          onClose={() => setShareModalProduct(null)}
        />
      )}

      {/* PROFILE EDIT MODAL */}
      {profileModalOpen && user && (
        <ProfileEditModal
          user={user}
          onSave={handleProfileSave}
          onClose={() => setProfileModalOpen(false)}
        />
      )}

      {/* SKIN TONE ANALYZER MODAL */}
      {analyzerProduct && (
        <SkinToneAnalyzerModal
          product={analyzerProduct}
          user={user}
          onClose={() => setAnalyzerProduct(null)}
        />
      )}

      {/* WRITE REVIEW MODAL */}
      {reviewModalOpen && reviewTarget && (
        <WriteReviewModal
          productName={reviewTarget.productName}
          onClose={() => setReviewModalOpen(false)}
          onSubmit={submitReview}
        />
      )}

      {/* CHATBOT */}
      <div className={`fixed bottom-6 left-6 z-[100] transition-all duration-300 ${chatOpen ? 'w-96 h-[550px]' : 'w-16 h-16 overflow-hidden'}`}>
        {chatOpen ? (
          <div className="bg-white w-full h-full rounded-2xl shadow-2xl border border-slate-100 flex flex-col animate-fade-in">
            <div className="bg-[#2874f0] p-6 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-xl backdrop-blur-md">
                  <i className="fa-solid fa-robot text-xl"></i>
                </div>
                <div>
                  <h4 className="font-black text-lg">Smart Assistant</h4>
                  <p className="text-[10px] uppercase font-bold opacity-60 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span> Online (2026 Engine)</p>
                </div>
              </div>
              <button onClick={() => setChatOpen(false)}><i className="fa-solid fa-xmark text-xl"></i></button>
            </div>
            <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-[#f8f9fa] custom-scrollbar">
              <div className="bg-white p-4 rounded-xl rounded-tl-none border border-slate-100 text-sm font-medium shadow-sm leading-relaxed text-slate-700">
                Welcome! I'm your SmartShop guide. I can help you find <span className="text-blue-600 font-bold">Jackets, Shoes, Lipsticks, and more</span>. What's on your mind?
              </div>
              {chatMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-xl text-sm font-medium shadow-sm leading-relaxed ${msg.role === 'user' ? 'bg-[#2874f0] text-white rounded-tr-none' : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'}`}>
                    {msg.role === 'user' ? (
                      <span className="whitespace-pre-wrap">{msg.text}</span>
                    ) : (
                      <div className="space-y-1">
                        {msg.text.split('\n').map((line, i) => {
                          // Inline product card
                          const prodMatch = line.match(/^\[PRODUCT:([\w-]+)\](.*)/);
                          if (prodMatch) {
                            const prod = products.find(p => p.id === prodMatch[1]);
                            const reason = prodMatch[2].trim();
                            if (prod) return (
                              <div key={i} className="flex gap-3 my-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
                                <img src={prod.image} alt={prod.name} className="w-16 h-16 object-cover rounded-lg flex-shrink-0 border border-blue-200" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-slate-800 text-sm leading-tight">{prod.name}</p>
                                  <p className="text-[#2874f0] font-black text-sm">₹{prod.price.toLocaleString('en-IN')}</p>
                                  {reason && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{reason}</p>}
                                  <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-xs text-amber-500 font-bold">★ {prod.rating}</span>
                                    <button onClick={() => { setSelectedProduct(prod); setView('detail'); setChatOpen(false); }} className="text-[10px] bg-[#2874f0] text-white px-3 py-1 rounded-full font-bold hover:bg-blue-700 transition-colors">View →</button>
                                  </div>
                                </div>
                              </div>
                            );
                            return null;
                          }
                          // Bold: **text**
                          const boldParsed = line.split(/(\*\*[^*]+\*\*)/).map((seg, j) =>
                            seg.startsWith('**') && seg.endsWith('**')
                              ? <strong key={j} className="text-slate-800">{seg.slice(2, -2)}</strong>
                              : seg
                          );
                          // Numbered list
                          if (/^\d+\.\s/.test(line)) return (
                            <div key={i} className="flex gap-2 text-sm">
                              <span className="text-[#2874f0] font-black shrink-0">{line.match(/^(\d+\.)/)?.[1]}</span>
                              <span>{line.replace(/^\d+\.\s/, '').split(/(\*\*[^*]+\*\*)/).map((s, j) => s.startsWith('**') && s.endsWith('**') ? <strong key={j} className="text-slate-800">{s.slice(2, -2)}</strong> : s)}</span>
                            </div>
                          );
                          // Bullet list • or -
                          if (/^[•\-]\s/.test(line)) return (
                            <div key={i} className="flex gap-2 text-sm">
                              <span className="text-[#2874f0] font-black shrink-0 mt-0.5">•</span>
                              <span>{line.replace(/^[•\-]\s/, '').split(/(\*\*[^*]+\*\*)/).map((s, j) => s.startsWith('**') && s.endsWith('**') ? <strong key={j} className="text-slate-800">{s.slice(2, -2)}</strong> : s)}</span>
                            </div>
                          );
                          // Section header (emoji-led or all-cap short)
                          if (line.match(/^[✨🎉💄👟🧥😎🛍️⭐🎊]/)) return (
                            <p key={i} className="font-bold text-slate-700 text-sm mt-2 mb-1">{boldParsed}</p>
                          );
                          // Empty line → spacer
                          if (!line.trim()) return <div key={i} className="h-1" />;
                          // Default paragraph
                          return <p key={i} className="text-sm leading-relaxed">{boldParsed}</p>;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t bg-white shrink-0">
              <form onSubmit={e => {
                e.preventDefault();
                const input = e.currentTarget.querySelector('input') as HTMLInputElement;
                if (input.value) { handleChat(input.value); input.value = ''; }
              }} className="flex gap-2">
                <input type="text" placeholder="Ask anything about the shop..." className="flex-grow bg-[#f0f5ff] p-4 rounded-xl outline-none text-sm font-medium" />
                <button type="submit" className="bg-[#2874f0] text-white w-14 h-14 rounded-xl flex items-center justify-center shadow-lg hover:scale-105 transition-all"><i className="fa-solid fa-paper-plane text-xl"></i></button>
              </form>
            </div>
          </div>
        ) : (
          <button onClick={() => setChatOpen(true)} className="relative w-full h-full bg-[#2874f0] text-white rounded-full shadow-2xl flex items-center justify-center text-3xl hover:scale-110 active:scale-95 transition-all shadow-[#2874f0]/40">
            <i className="fa-solid fa-comment-dots"></i>
            {unreadChat > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] min-w-[20px] h-5 rounded-full flex items-center justify-center font-black border-2 border-white shadow-md animate-bounce">
                {unreadChat}
              </span>
            )}
          </button>
        )}
      </div>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-16 mt-12">
        <div className="container mx-auto px-4 lg:px-20 grid grid-cols-2 md:grid-cols-4 gap-12">
          <div className="space-y-6 col-span-2 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="bg-[#2874f0] text-white w-8 h-8 rounded flex items-center justify-center font-black">S</div>
              <span className="text-xl font-extrabold italic text-slate-800 tracking-tighter">SmartShop AI</span>
            </div>
            <p className="text-slate-400 text-sm font-medium leading-relaxed">Discover the future of social shopping. India's first AI-integrated academic e-commerce prototype for the 2026 generation.</p>
          </div>
          <div>
            <h5 className="font-black text-xs uppercase tracking-[0.2em] text-slate-400 mb-6">Collections</h5>
            <ul className="space-y-3 text-sm font-bold text-slate-600">
              <li className="hover:text-blue-600 cursor-pointer">Men's Apparel</li>
              <li className="hover:text-blue-600 cursor-pointer">Women's Fashion</li>
              <li className="hover:text-blue-600 cursor-pointer">AR Beauty Hub</li>
              <li className="hover:text-blue-600 cursor-pointer">Sneaker Drop</li>
            </ul>
          </div>
          <div>
            <h5 className="font-black text-xs uppercase tracking-[0.2em] text-slate-400 mb-6">Connect</h5>
            <div className="flex gap-4 text-2xl text-slate-300">
              <i className="fa-brands fa-square-instagram hover:text-pink-500 cursor-pointer"></i>
              <i className="fa-brands fa-square-x-twitter hover:text-slate-900 cursor-pointer"></i>
              <i className="fa-brands fa-linkedin hover:text-blue-700 cursor-pointer"></i>
            </div>
          </div>
          <div className="space-y-6">
            <h5 className="font-black text-xs uppercase tracking-[0.2em] text-slate-400 mb-6">Experience 2026</h5>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
              <p className="text-[10px] font-black uppercase text-slate-400">Next-Gen Trial</p>
              <button onClick={() => { setArModelUrl(undefined); setArOpen(true); }} className="text-blue-600 font-black text-sm hover:underline">Launch Virtual Mirror</button>
            </div>
          </div>
        </div>
        <div className="container mx-auto text-center mt-16 pt-8 border-t border-slate-100">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300">&copy; 2024-2026 SmartShop AI • Global Academic Prototype</p>
        </div>
      </footer>

      {/* ── AR Try-On overlay (fullscreen, above everything) ────────────── */}
      {arOpen && (
        <TryOn
          initialModelUrl={arModelUrl}
          onClose={() => setArOpen(false)}
        />
      )}
    </div>
  );
}
