import React, { useState, useEffect } from 'react';
import { auth, loginWithGoogle, logout, db, OperationType, handleFirestoreError } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, Timestamp, collection, query, where, addDoc, updateDoc, deleteDoc, getDoc, getDocs, serverTimestamp, orderBy } from 'firebase/firestore';
import { 
  TrendingUp, 
  Wallet, 
  History, 
  LayoutDashboard, 
  LogOut, 
  LogIn, 
  ArrowUpRight, 
  ArrowDownRight,
  Search,
  RefreshCcw,
  Plus,
  Minus,
  AlertCircle,
  Bell,
  X,
  CreditCard,
  Smartphone,
  CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { cn } from './lib/utils';

// Types
interface MarketStock {
  symbol: string;
  name: string;
  price: number;
}

interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  balance: number;
  createdAt: any;
  role?: 'admin' | 'user';
}

interface MarketAlert {
  id: string;
  uid: string;
  symbol: string;
  threshold: number;
  direction: 'above' | 'below';
  status: 'active' | 'triggered';
  createdAt: any;
  triggeredAt?: any;
  triggerPrice?: number;
}

interface PortfolioItem {
  id: string;
  uid: string;
  symbol: string;
  quantity: number;
  averagePrice: number;
  updatedAt: any;
}

interface TradeRecord {
  id: string;
  uid: string;
  symbol: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  timestamp: any;
}

interface PaymentMethod {
  id: string;
  name: string;
  type: 'card' | 'mpesa';
  details: string;
  isActive: boolean;
  createdAt: any;
}

// Components
const Navbar = ({ user, isAdmin, onLogout, onLogin, currentView, onViewChange }: { 
  user: User | null, 
  isAdmin: boolean,
  onLogout: () => void, 
  onLogin: () => void,
  currentView: 'dashboard' | 'admin',
  onViewChange: (view: 'dashboard' | 'admin') => void
}) => (
  <nav className="border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-50">
    <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => onViewChange('dashboard')}>
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <TrendingUp className="text-white w-5 h-5" />
          </div>
          <span className="font-bold text-xl tracking-tight text-white">TradeFlow</span>
        </div>
        
        {user && (
          <div className="hidden md:flex items-center gap-1">
            <button 
              onClick={() => onViewChange('dashboard')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                currentView === 'dashboard' ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              Dashboard
            </button>
            {isAdmin && (
              <button 
                onClick={() => onViewChange('admin')}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
                  currentView === 'admin' ? "bg-orange-500/10 text-orange-500" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                <LayoutDashboard className="w-4 h-4" />
                Admin Panel
              </button>
            )}
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-4">
        {user ? (
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-white">{user.displayName}</p>
              <p className="text-xs text-zinc-500">{user.email}</p>
            </div>
            <button 
              onClick={onLogout}
              className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <button 
            onClick={onLogin}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-all"
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </button>
        )}
      </div>
    </div>
  </nav>
);

const StatCard = ({ title, value, icon: Icon, trend, prefix = "" }: any) => (
  <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl">
    <div className="flex items-center justify-between mb-4">
      <div className="p-2 bg-zinc-800 rounded-lg">
        <Icon className="w-5 h-5 text-zinc-400" />
      </div>
      {trend && (
        <span className={cn(
          "text-xs font-medium px-2 py-1 rounded-full",
          trend > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
        )}>
          {trend > 0 ? "+" : ""}{trend}%
        </span>
      )}
    </div>
    <p className="text-sm text-zinc-500 mb-1">{title}</p>
    <h3 className="text-2xl font-bold text-white">{prefix}{value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
  </div>
);

const StockRow = ({ stock, onSelect, isSelected }: { stock: MarketStock, onSelect: (s: MarketStock) => void, isSelected: boolean, key?: React.Key }) => (
  <div 
    onClick={() => onSelect(stock)}
    className={cn(
      "flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all border",
      isSelected ? "bg-orange-500/10 border-orange-500/50" : "bg-zinc-900/30 border-transparent hover:border-zinc-700 hover:bg-zinc-900/50"
    )}
  >
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center font-bold text-zinc-400">
        {stock.symbol[0]}
      </div>
      <div>
        <p className="font-bold text-white">{stock.symbol}</p>
        <p className="text-xs text-zinc-500">{stock.name}</p>
      </div>
    </div>
    <div className="text-right">
      <p className="font-bold text-white">${stock.price.toFixed(2)}</p>
      <p className="text-xs text-emerald-500">+{(Math.random() * 2).toFixed(2)}%</p>
    </div>
  </div>
);

const AdminPanel = ({ allUsers, allTrades, paymentMethods, onAddPaymentMethod, onDeletePaymentMethod }: { 
  allUsers: UserProfile[], 
  allTrades: TradeRecord[],
  paymentMethods: PaymentMethod[],
  onAddPaymentMethod: (name: string, type: 'card' | 'mpesa', details: string) => void,
  onDeletePaymentMethod: (id: string) => void
}) => {
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<'card' | 'mpesa'>('card');
  const [newDetails, setNewDetails] = useState("");

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Users" value={allUsers.length} icon={LayoutDashboard} />
        <StatCard title="Total Trades" value={allTrades.length} icon={History} />
        <StatCard title="Total System Volume" value={allTrades.reduce((acc, t) => acc + (t.price * t.quantity), 0)} icon={TrendingUp} prefix="$" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* User Management */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-zinc-800">
            <h2 className="text-xl font-bold text-white">User Management</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                  <th className="px-6 py-4 font-medium">User</th>
                  <th className="px-6 py-4 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {allUsers.map((u) => (
                  <tr key={u.uid} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-white">{u.displayName}</p>
                      <p className="text-xs text-zinc-500">{u.email}</p>
                    </td>
                    <td className="px-6 py-4 font-bold text-orange-500">${u.balance.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment Methods Management */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Payment Methods</h2>
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <CreditCard className="w-5 h-5 text-orange-500" />
            </div>
          </div>
          <div className="p-6 space-y-6">
            <div className="space-y-4 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
              <p className="text-sm font-bold text-white">Add New Method</p>
              <div className="grid grid-cols-2 gap-4">
                <input 
                  placeholder="Method Name (e.g. M-Pesa Official)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                />
                <select 
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as 'card' | 'mpesa')}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                >
                  <option value="card">Card</option>
                  <option value="mpesa">M-Pesa</option>
                </select>
              </div>
              <textarea 
                placeholder="Details/Instructions (e.g. Pay to +254...)"
                value={newDetails}
                onChange={(e) => setNewDetails(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 h-20"
              />
              <button 
                onClick={() => {
                  onAddPaymentMethod(newName, newType, newDetails);
                  setNewName("");
                  setNewDetails("");
                }}
                disabled={!newName || !newDetails}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold py-2 rounded-lg transition-colors"
              >
                Add Method
              </button>
            </div>

            <div className="space-y-3">
              {paymentMethods.map(method => (
                <div key={method.id} className="flex items-center justify-between p-4 bg-zinc-800/30 rounded-xl border border-zinc-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-zinc-800 rounded-lg">
                      {method.type === 'mpesa' ? <Smartphone className="w-4 h-4 text-emerald-500" /> : <CreditCard className="w-4 h-4 text-blue-500" />}
                    </div>
                    <div>
                      <p className="font-bold text-white">{method.name}</p>
                      <p className="text-xs text-zinc-500 truncate max-w-[200px]">{method.details}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => onDeletePaymentMethod(method.id)}
                    className="p-2 text-zinc-500 hover:text-rose-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="text-xl font-bold text-white">Global Trade History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                <th className="px-6 py-4 font-medium">Asset</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium">Qty</th>
                <th className="px-6 py-4 font-medium">Price</th>
                <th className="px-6 py-4 font-medium">Total</th>
                <th className="px-6 py-4 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {allTrades.map((t) => (
                <tr key={t.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-6 py-4 font-bold text-white">{t.symbol}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded text-[10px] font-bold uppercase",
                      t.type === 'buy' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                    )}>
                      {t.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">{t.quantity}</td>
                  <td className="px-6 py-4">${t.price.toFixed(2)}</td>
                  <td className="px-6 py-4 font-bold text-white">${(t.price * t.quantity).toFixed(2)}</td>
                  <td className="px-6 py-4 text-zinc-500 text-xs">{t.timestamp?.toDate().toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [market, setMarket] = useState<MarketStock[]>([]);
  const [selectedStock, setSelectedStock] = useState<MarketStock | null>(null);
  const [tradeAmount, setTradeAmount] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'admin'>('dashboard');
  
  // Admin states
  const [isAdmin, setIsAdmin] = useState(false);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [allTrades, setAllTrades] = useState<TradeRecord[]>([]);
  const [alerts, setAlerts] = useState<MarketAlert[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [alertThreshold, setAlertThreshold] = useState<string>("");
  const [alertDirection, setAlertDirection] = useState<'above' | 'below'>('above');
  const [isCreatingAlert, setIsCreatingAlert] = useState(false);

  const ADMIN_EMAIL = "waithaka.njoroge3580@gmail.com";

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        setIsAdmin(u.email === ADMIN_EMAIL);
        // Initialize or fetch profile
        const userRef = doc(db, 'users', u.uid);
        try {
          const snap = await getDoc(userRef);
          if (!snap.exists()) {
            const newProfile: UserProfile = {
              uid: u.uid,
              displayName: u.displayName || 'Trader',
              email: u.email || '',
              balance: 10000, // Starting balance
              createdAt: Timestamp.now()
            };
            await setDoc(userRef, newProfile);
            setProfile(newProfile);
          } else {
            const data = snap.data() as UserProfile;
            setProfile(data);
            if (data.role === 'admin') setIsAdmin(true);
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${u.uid}`);
        }
      } else {
        setProfile(null);
        setPortfolio([]);
        setTrades([]);
        setIsAdmin(false);
        setCurrentView('dashboard');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Data Listeners
  useEffect(() => {
    if (!user) return;

    const portfolioQuery = query(collection(db, 'portfolio'), where('uid', '==', user.uid));
    const unsubPortfolio = onSnapshot(portfolioQuery, (snap) => {
      setPortfolio(snap.docs.map(d => ({ id: d.id, ...d.data() } as PortfolioItem)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'portfolio'));

    const tradesQuery = query(collection(db, 'trades'), where('uid', '==', user.uid));
    const unsubTrades = onSnapshot(tradesQuery, (snap) => {
      const sortedTrades = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as TradeRecord))
        .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
      setTrades(sortedTrades);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'trades'));

    // Admin listeners
    let unsubAllUsers = () => {};
    let unsubAllTrades = () => {};

    if (isAdmin) {
      unsubAllUsers = onSnapshot(collection(db, 'users'), (snap) => {
        setAllUsers(snap.docs.map(d => d.data() as UserProfile));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

      unsubAllTrades = onSnapshot(collection(db, 'trades'), (snap) => {
        setAllTrades(snap.docs.map(d => ({ id: d.id, ...d.data() } as TradeRecord)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'trades'));
    }

    // Alerts Listener
    const alertsQuery = query(collection(db, 'alerts'), where('uid', '==', user.uid));
    const unsubAlerts = onSnapshot(alertsQuery, (snap) => {
      const sortedAlerts = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as MarketAlert))
        .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
      setAlerts(sortedAlerts);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'alerts'));

    const unsubMethods = onSnapshot(collection(db, 'payment_methods'), (snap) => {
      const methods = snap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentMethod));
      setPaymentMethods(methods);
      
      // Bootstrap default M-Pesa if none exist and user is admin
      if (methods.length === 0 && isAdmin) {
        addDoc(collection(db, 'payment_methods'), {
          name: "M-Pesa Official",
          type: "mpesa",
          details: "Pay to M-Pesa Number: +254113445313. Send screenshot to support.",
          isActive: true,
          createdAt: serverTimestamp()
        });
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'payment_methods'));

    return () => {
      unsubPortfolio();
      unsubTrades();
      unsubAllUsers();
      unsubAllTrades();
      unsubAlerts();
      unsubMethods();
    };
  }, [user, isAdmin]);

  // Market Data Polling
  useEffect(() => {
    const fetchMarket = async () => {
      try {
        const res = await fetch('/api/market');
        const data = await res.json();
        setMarket(data);
        if (!selectedStock && data.length > 0) setSelectedStock(data[0]);
      } catch (err) {
        console.error("Market fetch error:", err);
      }
    };
    fetchMarket();
    const interval = setInterval(fetchMarket, 5000);
    return () => clearInterval(interval);
  }, [selectedStock]);

  const handleTrade = async (type: 'buy' | 'sell') => {
    if (!user || !profile || !selectedStock) return;
    
    const cost = selectedStock.price * tradeAmount;
    const currentHolding = portfolio.find(p => p.symbol === selectedStock.symbol);

    if (type === 'buy' && profile.balance < cost) {
      setError("Insufficient balance");
      return;
    }

    if (type === 'sell' && (!currentHolding || currentHolding.quantity < tradeAmount)) {
      setError("Insufficient shares");
      return;
    }

    try {
      // 1. Create Trade Record
      await addDoc(collection(db, 'trades'), {
        uid: user.uid,
        symbol: selectedStock.symbol,
        type,
        quantity: tradeAmount,
        price: selectedStock.price,
        timestamp: Timestamp.now()
      });

      // 2. Update Balance
      const newBalance = type === 'buy' ? profile.balance - cost : profile.balance + cost;
      await updateDoc(doc(db, 'users', user.uid), { balance: newBalance });
      setProfile(prev => prev ? { ...prev, balance: newBalance } : null);

      // 3. Update Portfolio
      if (currentHolding) {
        const newQty = type === 'buy' ? currentHolding.quantity + tradeAmount : currentHolding.quantity - tradeAmount;
        if (newQty === 0) {
          await deleteDoc(doc(db, 'portfolio', currentHolding.id));
        } else {
          const newAvgPrice = type === 'buy' 
            ? (currentHolding.averagePrice * currentHolding.quantity + cost) / newQty
            : currentHolding.averagePrice;
          await updateDoc(doc(db, 'portfolio', currentHolding.id), {
            quantity: newQty,
            averagePrice: newAvgPrice,
            updatedAt: Timestamp.now()
          });
        }
      } else if (type === 'buy') {
        await addDoc(collection(db, 'portfolio'), {
          uid: user.uid,
          symbol: selectedStock.symbol,
          quantity: tradeAmount,
          averagePrice: selectedStock.price,
          updatedAt: Timestamp.now()
        });
      }

      setError(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'trades/portfolio/users');
    }
  };

  const handleCreateAlert = async () => {
    if (!user || !selectedStock || !alertThreshold || isCreatingAlert) return;
    setIsCreatingAlert(true);

    try {
      await addDoc(collection(db, "alerts"), {
        uid: user.uid,
        symbol: selectedStock.symbol,
        threshold: parseFloat(alertThreshold),
        direction: alertDirection,
        status: "active",
        createdAt: serverTimestamp()
      });
      setAlertThreshold("");
      setError(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "alerts");
    } finally {
      setIsCreatingAlert(false);
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    try {
      await deleteDoc(doc(db, "alerts", alertId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, "alerts");
    }
  };

  const handleAddPaymentMethod = async (name: string, type: 'card' | 'mpesa', details: string) => {
    try {
      await addDoc(collection(db, 'payment_methods'), {
        name,
        type,
        details,
        isActive: true,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'payment_methods');
    }
  };

  const handleDeletePaymentMethod = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'payment_methods', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'payment_methods');
    }
  };

  const totalPortfolioValue = portfolio.reduce((acc, item) => {
    const currentPrice = market.find(s => s.symbol === item.symbol)?.price || item.averagePrice;
    return acc + (currentPrice * item.quantity);
  }, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <RefreshCcw className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-300 font-sans selection:bg-orange-500/30">
      <Navbar 
        user={user} 
        isAdmin={isAdmin}
        onLogin={loginWithGoogle} 
        onLogout={logout} 
        currentView={currentView}
        onViewChange={setCurrentView}
      />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {!user ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-orange-500/10 rounded-3xl flex items-center justify-center mb-8">
              <TrendingUp className="w-10 h-10 text-orange-500" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">Welcome to TradeFlow</h1>
            <p className="text-zinc-500 max-w-md mb-8">
              The professional trading platform for modern investors. Sign in to start building your portfolio with simulated funds.
            </p>
            <button 
              onClick={loginWithGoogle}
              className="flex items-center gap-3 bg-white text-black hover:bg-zinc-200 px-8 py-4 rounded-2xl font-bold transition-all transform hover:scale-105"
            >
              <LogIn className="w-5 h-5" />
              Get Started with Google
            </button>
          </div>
        ) : currentView === 'admin' && isAdmin ? (
          <AdminPanel 
            allUsers={allUsers} 
            allTrades={allTrades} 
            paymentMethods={paymentMethods}
            onAddPaymentMethod={handleAddPaymentMethod}
            onDeletePaymentMethod={handleDeletePaymentMethod}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Left Column: Stats & Market */}
            <div className="lg:col-span-8 space-y-8">
              
              {/* Deposit Section */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-orange-500" />
                    Add Funds
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {paymentMethods.map(method => (
                    <div key={method.id} className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl hover:border-orange-500/50 transition-all group">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-zinc-900 rounded-lg group-hover:bg-orange-500/10 transition-colors">
                          {method.type === 'mpesa' ? <Smartphone className="w-5 h-5 text-emerald-500" /> : <CreditCard className="w-5 h-5 text-blue-500" />}
                        </div>
                        <p className="font-bold text-white">{method.name}</p>
                      </div>
                      <p className="text-xs text-zinc-500 mb-4 leading-relaxed whitespace-pre-wrap">{method.details}</p>
                      <button className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2">
                        <CheckCircle className="w-3 h-3" />
                        I've Made Payment
                      </button>
                    </div>
                  ))}
                  {paymentMethods.length === 0 && (
                    <p className="text-zinc-500 text-sm italic">No payment methods available at the moment.</p>
                  )}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard 
                  title="Total Balance" 
                  value={profile?.balance || 0} 
                  icon={Wallet} 
                  prefix="$"
                />
                <StatCard 
                  title="Portfolio Value" 
                  value={totalPortfolioValue} 
                  icon={TrendingUp} 
                  prefix="$"
                  trend={12.5}
                />
                <StatCard 
                  title="Net Worth" 
                  value={(profile?.balance || 0) + totalPortfolioValue} 
                  icon={LayoutDashboard} 
                  prefix="$"
                />
              </div>

              {/* Market Chart (Simulated) */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-white">Market Overview</h2>
                    <p className="text-sm text-zinc-500">Real-time simulated data</p>
                  </div>
                  <div className="flex gap-2">
                    {['1D', '1W', '1M', '1Y'].map(t => (
                      <button key={t} className={cn(
                        "px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                        t === '1D' ? "bg-orange-500 text-white" : "text-zinc-500 hover:bg-zinc-800"
                      )}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={[
                      { time: '09:00', price: 145 },
                      { time: '10:00', price: 148 },
                      { time: '11:00', price: 147 },
                      { time: '12:00', price: 152 },
                      { time: '13:00', price: 150 },
                      { time: '14:00', price: 155 },
                      { time: '15:00', price: 153 },
                      { time: '16:00', price: 158 },
                    ]}>
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="time" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '12px' }}
                        itemStyle={{ color: '#f97316' }}
                      />
                      <Area type="monotone" dataKey="price" stroke="#f97316" fillOpacity={1} fill="url(#colorPrice)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Portfolio Table */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-zinc-800">
                  <h2 className="text-xl font-bold text-white">Your Holdings</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                        <th className="px-6 py-4 font-medium">Asset</th>
                        <th className="px-6 py-4 font-medium">Quantity</th>
                        <th className="px-6 py-4 font-medium">Avg. Price</th>
                        <th className="px-6 py-4 font-medium">Current</th>
                        <th className="px-6 py-4 font-medium">Profit/Loss</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {portfolio.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                            No holdings yet. Start trading to see your portfolio.
                          </td>
                        </tr>
                      ) : (
                        portfolio.map((item) => {
                          const currentPrice = market.find(s => s.symbol === item.symbol)?.price || 0;
                          const pl = (currentPrice - item.averagePrice) * item.quantity;
                          const plPercent = ((currentPrice - item.averagePrice) / item.averagePrice) * 100;
                          return (
                            <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-zinc-800 rounded flex items-center justify-center text-xs font-bold">
                                    {item.symbol[0]}
                                  </div>
                                  <span className="font-bold text-white">{item.symbol}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">{item.quantity}</td>
                              <td className="px-6 py-4">${item.averagePrice.toFixed(2)}</td>
                              <td className="px-6 py-4 font-bold text-white">${currentPrice.toFixed(2)}</td>
                              <td className="px-6 py-4">
                                <span className={cn(
                                  "flex items-center gap-1 font-medium",
                                  pl >= 0 ? "text-emerald-500" : "text-rose-500"
                                )}>
                                  {pl >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                                  ${Math.abs(pl).toFixed(2)} ({plPercent.toFixed(2)}%)
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Column: Trade & History */}
            <div className="lg:col-span-4 space-y-8">
              
              {/* Trade Panel */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 sticky top-24">
                <h2 className="text-xl font-bold text-white mb-6">Quick Trade</h2>
                
                <div className="space-y-4 mb-8">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input 
                      type="text" 
                      placeholder="Search assets..." 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-orange-500 transition-colors"
                    />
                  </div>
                  
                  <div className="space-y-2 max-h-[240px] overflow-y-auto pr-2 custom-scrollbar">
                    {market.map(stock => (
                      <StockRow 
                        key={stock.symbol} 
                        stock={stock} 
                        onSelect={setSelectedStock}
                        isSelected={selectedStock?.symbol === stock.symbol}
                      />
                    ))}
                  </div>
                </div>

                {selectedStock && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center justify-between p-4 bg-zinc-950 rounded-xl border border-zinc-800">
                      <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold">Price</p>
                        <p className="text-xl font-bold text-white">${selectedStock.price.toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold">Total</p>
                        <p className="text-xl font-bold text-orange-500">${(selectedStock.price * tradeAmount).toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setTradeAmount(Math.max(1, tradeAmount - 1))}
                        className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <input 
                        type="number" 
                        value={tradeAmount}
                        onChange={(e) => setTradeAmount(Math.max(1, parseInt(e.target.value) || 1))}
                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl py-3 text-center font-bold text-white focus:outline-none focus:border-orange-500"
                      />
                      <button 
                        onClick={() => setTradeAmount(tradeAmount + 1)}
                        className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 text-rose-500 text-sm bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => handleTrade('buy')}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20"
                      >
                        Buy {selectedStock.symbol}
                      </button>
                      <button 
                        onClick={() => handleTrade('sell')}
                        className="bg-rose-500 hover:bg-rose-600 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-rose-500/20"
                      >
                        Sell {selectedStock.symbol}
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Price Alerts */}
              <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl">
                <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-orange-500" />
                  Price Alerts
                </h2>

                {selectedStock && (
                  <div className="space-y-4 mb-6 pb-6 border-b border-zinc-800">
                    <p className="text-sm text-zinc-400">Set alert for <span className="text-white font-bold">{selectedStock.symbol}</span></p>
                    <div className="flex gap-2">
                      <select 
                        value={alertDirection}
                        onChange={(e) => setAlertDirection(e.target.value as 'above' | 'below')}
                        className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                      >
                        <option value="above">Above</option>
                        <option value="below">Below</option>
                      </select>
                      <input 
                        type="number"
                        value={alertThreshold}
                        onChange={(e) => setAlertThreshold(e.target.value)}
                        placeholder="Price"
                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                      />
                      <button 
                        onClick={handleCreateAlert}
                        disabled={isCreatingAlert || !alertThreshold}
                        className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 p-2 rounded-xl text-white transition-colors"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {alerts.length === 0 ? (
                    <p className="text-center text-zinc-500 text-sm py-4">No alerts set</p>
                  ) : (
                    alerts.map(alert => (
                      <div key={alert.id} className={cn(
                        "p-3 rounded-xl border flex items-center justify-between transition-all",
                        alert.status === 'triggered' ? "bg-orange-500/10 border-orange-500/30" : "bg-zinc-800/30 border-zinc-800"
                      )}>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{alert.symbol}</span>
                            <span className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded uppercase font-bold",
                              alert.status === 'triggered' ? "bg-orange-500 text-white" : "bg-zinc-700 text-zinc-400"
                            )}>
                              {alert.status}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500">
                            {alert.direction === 'above' ? '≥' : '≤'} ${alert.threshold.toFixed(2)}
                            {alert.status === 'triggered' && alert.triggerPrice && (
                              <span className="ml-1 text-orange-400 font-medium">
                                (Hit ${alert.triggerPrice.toFixed(2)})
                              </span>
                            )}
                          </p>
                        </div>
                        <button 
                          onClick={() => handleDeleteAlert(alert.id)}
                          className="p-1.5 text-zinc-500 hover:text-rose-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Trade History */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white">Recent Activity</h2>
                  <History className="w-5 h-5 text-zinc-500" />
                </div>
                <div className="space-y-4">
                  {trades.length === 0 ? (
                    <p className="text-center text-zinc-500 py-4">No recent trades</p>
                  ) : (
                    trades.slice(0, 5).map((trade) => (
                      <div key={trade.id} className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            trade.type === 'buy' ? "bg-emerald-500" : "bg-rose-500"
                          )} />
                          <div>
                            <p className="text-sm font-bold text-white">{trade.type === 'buy' ? 'Bought' : 'Sold'} {trade.quantity} {trade.symbol}</p>
                            <p className="text-[10px] text-zinc-500 uppercase">{trade.timestamp?.toDate().toLocaleString()}</p>
                          </div>
                        </div>
                        <p className="text-sm font-medium text-zinc-400">${(trade.price * trade.quantity).toFixed(2)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-800 mt-20 py-12 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-orange-500/20 rounded flex items-center justify-center">
              <TrendingUp className="text-orange-500 w-4 h-4" />
            </div>
            <span className="font-bold text-zinc-400">TradeFlow</span>
          </div>
          <p className="text-sm text-zinc-600">© 2026 TradeFlow. All rights reserved. Simulated trading platform for educational purposes.</p>
          <div className="flex gap-6">
            <a href="#" className="text-zinc-600 hover:text-zinc-400 transition-colors">Privacy</a>
            <a href="#" className="text-zinc-600 hover:text-zinc-400 transition-colors">Terms</a>
            <a href="#" className="text-zinc-600 hover:text-zinc-400 transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
