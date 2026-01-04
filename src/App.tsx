import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { Shield, Zap, Brain, TrendingUp, Activity, AlertTriangle, Check, ShoppingBag, Plus, Minus, Lock, Key, Skull, Trash2, X, Settings } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { PlayerState, INITIAL_STATE, Quest, Stats, ShopItem, Difficulty, ItemTier } from './types';
import { DIFFICULTY_REWARDS, TIER_COSTS, DEFAULT_QUEST_POOL, DEFAULT_SHOP_ITEMS, PENALTY_QUESTS, DUNGEON_QUESTS } from './constants';

// --- Utility Functions ---

const loadState = (): PlayerState => {
  try {
    const saved = localStorage.getItem('system_player_state');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migration/Default logic
      if (!parsed.questPool || parsed.questPool.length === 0) {
        parsed.questPool = [...DEFAULT_QUEST_POOL];
      }
      if (!parsed.shopItems || parsed.shopItems.length === 0) {
        parsed.shopItems = [...DEFAULT_SHOP_ITEMS];
      }
      if (parsed.currentStreak === undefined) {
        parsed.currentStreak = 0;
      }
      // Migrate quests to have relatedStat if missing
      parsed.questPool = parsed.questPool.map((q: any) => ({
        ...q,
        relatedStat: q.relatedStat || 'STR' // Default to STR if missing
      }));
      parsed.dailyQuests = parsed.dailyQuests.map((q: any) => ({
        ...q,
        relatedStat: q.relatedStat || 'STR'
      }));
      
      return parsed;
    }
  } catch (e) {
    console.error("Failed to load state", e);
  }
  return {
    ...INITIAL_STATE,
    questPool: [...DEFAULT_QUEST_POOL],
    shopItems: [...DEFAULT_SHOP_ITEMS],
  };
};

const saveState = (state: PlayerState) => {
  localStorage.setItem('system_player_state', JSON.stringify(state));
};

const getTodayDate = () => new Date().toISOString().split('T')[0];

const generateDailyQuests = (pool: Omit<Quest, 'id' | 'isCompleted' | 'type'>[]): Quest[] => {
  const shuffled = [...pool].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 5).map((q, i) => ({
    ...q,
    id: `daily-${Date.now()}-${i}`,
    isCompleted: false,
    type: 'daily',
  }));
};

const generatePenaltyQuest = (): Quest => {
  const random = PENALTY_QUESTS[Math.floor(Math.random() * PENALTY_QUESTS.length)];
  return {
    ...random,
    id: `penalty-${Date.now()}`,
    isCompleted: false,
    type: 'penalty',
  };
};

const generateDungeonQuest = (): Quest => {
  const random = DUNGEON_QUESTS[Math.floor(Math.random() * DUNGEON_QUESTS.length)];
  return {
    ...random,
    id: `dungeon-${Date.now()}`,
    isCompleted: false,
    type: 'daily', // Treat as daily for completion logic, but special UI
  };
};

const getRank = (level: number): string => {
  if (level >= 100) return "S-Rank";
  if (level >= 71) return "A-Rank";
  if (level >= 41) return "B-Rank";
  if (level >= 21) return "C-Rank";
  if (level >= 11) return "D-Rank";
  return "E-Rank";
};

// --- Audio & Haptic Utilities ---

const triggerHaptic = (type: 'light' | 'medium' | 'heavy') => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    switch (type) {
      case 'light': navigator.vibrate(10); break;
      case 'medium': navigator.vibrate(20); break;
      case 'heavy': navigator.vibrate([50, 30, 50]); break;
    }
  }
};

const playSystemSound = (type: 'click' | 'success' | 'levelup' | 'error') => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    const now = ctx.currentTime;
    
    switch (type) {
      case 'click':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
        break;
        
      case 'success': // Quest Complete
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.2);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
        break;
        
      case 'levelup':
        // Arpeggio
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C Major
        notes.forEach((freq, i) => {
          const oscN = ctx.createOscillator();
          const gainN = ctx.createGain();
          oscN.connect(gainN);
          gainN.connect(ctx.destination);
          
          oscN.type = 'square';
          oscN.frequency.value = freq;
          
          const start = now + (i * 0.1);
          gainN.gain.setValueAtTime(0.1, start);
          gainN.gain.exponentialRampToValueAtTime(0.01, start + 0.3);
          
          oscN.start(start);
          oscN.stop(start + 0.3);
        });
        break;

      case 'error':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.2);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
        break;
    }
  } catch (e) {
    console.error("Audio play failed", e);
  }
};

// --- Components ---

const SwipeableItem = ({ children, onDelete }: { children: React.ReactNode, onDelete: () => void }) => {
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-100, -50, 0], [0, 1, 1]);
  const color = useTransform(x, [-100, 0], ["#FF003C", "transparent"]);
  
  return (
    <motion.div style={{ x, position: 'relative' }} drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.1} 
      onDragEnd={(_, info) => {
        if (info.offset.x < -100) {
          onDelete();
        }
      }}
      className="touch-pan-y"
    >
      <motion.div style={{ opacity, backgroundColor: color }} className="absolute inset-0 flex items-center justify-end pr-4 rounded-lg z-0">
        <Trash2 className="text-white w-6 h-6" />
      </motion.div>
      <div className="relative z-10 bg-abyss">
        {children}
      </div>
    </motion.div>
  );
};

const StatsRadarChart: React.FC<{ stats: Stats }> = ({ stats }) => {
  const data = [
    { subject: 'STR', value: stats.str },
    { subject: 'VIT', value: stats.vit },
    { subject: 'AGI', value: stats.agi },
    { subject: 'INT', value: stats.int },
    { subject: 'SEN', value: stats.sen },
  ];

  // Dynamic max value to keep the chart looking balanced, minimum 20
  const maxVal = Math.max(...Object.values(stats), 20);

  return (
    <div className="h-64 w-full relative -my-4">
       <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="65%" data={data}>
          <PolarGrid stroke="#1f2937" />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: '#00A8FF', fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' }} 
          />
          <PolarRadiusAxis angle={30} domain={[0, maxVal]} tick={false} axisLine={false} />
          <Radar
            name="Stats"
            dataKey="value"
            stroke="#00A8FF"
            strokeWidth={2}
            fill="#00A8FF"
            fillOpacity={0.4}
            isAnimationActive={true}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

const StatRow: React.FC<{ label: string, value: number, icon: any }> = ({ label, value, icon: Icon }) => (
  <div className="flex items-center justify-between p-2 border border-system-blue/20 bg-abyss/50 rounded hover:bg-system-blue/5 transition-colors box-glow-subtle">
    <div className="flex items-center gap-3">
      <Icon className="w-5 h-5 text-system-blue" />
      <span className="text-gray-300 font-bold">{label}</span>
    </div>
    <div className="flex items-center gap-4">
      <span className="text-xl font-mono text-white text-glow">{value.toFixed(1)}</span>
    </div>
  </div>
);

const QuestItem: React.FC<{ 
  quest: Quest, 
  onComplete?: (id: string) => void, 
  onDelete?: () => void,
  onAddToDaily?: () => void,
  onRemoveFromDaily?: () => void,
  onEdit?: () => void
}> = ({ quest, onComplete, onDelete, onAddToDaily, onRemoveFromDaily, onEdit }) => {
  const content = (
    <div className={`relative p-4 border-l-4 ${quest.isCompleted ? 'border-gray-600 bg-gray-900/30' : 'border-system-blue bg-system-blue/5'} mb-3 rounded-r-lg overflow-hidden group box-glow transition-all hover:scale-[1.02]`}>
      <div className="flex items-center justify-between z-10 relative">
        <div>
          <h3 className={`font-bold ${quest.isCompleted ? 'text-gray-500 line-through' : 'text-white'}`}>
            {quest.title}
          </h3>
          <div className="flex gap-3 text-xs mt-1">
            <span className={`${quest.isCompleted ? 'text-gray-600' : 'text-system-blue'}`}>XP +{quest.xpReward}</span>
            <span className={`${quest.isCompleted ? 'text-gray-600' : 'text-yellow-500'}`}>GOLD +{quest.goldReward}</span>
            {quest.difficulty && <span className="text-purple-400 font-bold">[{quest.difficulty}-Rank]</span>}
            {quest.relatedStat && <span className="text-green-400 font-bold">[{quest.relatedStat}]</span>}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {onAddToDaily && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddToDaily(); }}
              className="p-2 rounded-full border border-system-blue text-system-blue hover:bg-system-blue hover:text-black transition-all"
              title="Add to Daily Schedule"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}

          {onRemoveFromDaily && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemoveFromDaily(); }}
              className="p-2 rounded-full border border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-black transition-all"
              title="Remove from Daily Schedule"
            >
              <Minus className="w-4 h-4" />
            </button>
          )}
          
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-2 rounded-full border border-gray-500 text-gray-500 hover:bg-gray-700 hover:text-white transition-all"
              title="Edit Quest"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          {onComplete && (
            <button
              onClick={() => !quest.isCompleted && onComplete(quest.id)}
              disabled={quest.isCompleted}
              className={`p-2 rounded-full border ${
                quest.isCompleted
                  ? 'border-gray-600 text-gray-600'
                  : 'border-system-blue text-system-blue hover:bg-system-blue hover:text-black'
              } transition-all`}
            >
              <Check className="w-5 h-5" />
            </button>
          )}
          
          {onDelete && !onComplete && (
             <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-2 rounded-full border border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-all"
              title="Delete Quest"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (onDelete && onComplete) {
    // Only swipeable in daily view (where onComplete exists)
    return <SwipeableItem onDelete={onDelete}>{content}</SwipeableItem>;
  }
  return content;
};

const ShopItemCard: React.FC<{ item: ShopItem, canAfford: boolean, onBuy: () => void, onDelete?: () => void }> = ({ item, canAfford, onBuy, onDelete }) => {
  const content = (
    <div className="p-4 border border-system-blue/30 rounded bg-abyss/80 hover:border-system-blue hover:box-glow transition-all mb-3">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-bold text-white">{item.name}</h3>
        <span className="text-yellow-400 font-mono">{item.cost} G</span>
      </div>
      <p className="text-xs text-gray-400 mb-4">{item.description}</p>
      {item.tier && <p className="text-xs text-purple-400 mb-2 font-bold uppercase">{item.tier}</p>}
      <button
        onClick={onBuy}
        disabled={!canAfford}
        className={`w-full py-2 text-sm font-bold uppercase tracking-wider border ${
          canAfford
            ? 'border-system-blue text-system-blue hover:bg-system-blue hover:text-black cursor-pointer'
            : 'border-gray-700 text-gray-700 cursor-not-allowed'
        } transition-all`}
      >
        {canAfford ? 'Purchase' : 'Insufficient Funds'}
      </button>
    </div>
  );

  if (onDelete) {
    return <SwipeableItem onDelete={onDelete}>{content}</SwipeableItem>;
  }
  return content;
};

const AddItemModal = ({ isOpen, onClose, onAdd, editData }: { isOpen: boolean, onClose: () => void, onAdd: (type: 'quest' | 'reward', data: any) => void, editData?: any }) => {
  const [type, setType] = useState<'quest' | 'reward'>('quest');
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('E');
  const [relatedStat, setRelatedStat] = useState<StatType>('STR');
  const [tier, setTier] = useState<ItemTier>('Small');
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    if (editData) {
      setType(editData.type || 'quest');
      setTitle(editData.title || '');
      setDifficulty(editData.difficulty || 'E');
      setRelatedStat(editData.relatedStat || 'STR');
      setTier(editData.tier || 'Small');
    } else {
      // Reset defaults
      setTitle('');
      setDifficulty('E');
      setRelatedStat('STR');
      setTier('Small');
    }
  }, [editData, isOpen]);

  const handleSubmit = () => {
    setIsCalculating(true);
    setTimeout(() => {
      setIsCalculating(false);
      onAdd(type, type === 'quest' ? { title, difficulty, relatedStat } : { title, tier });
      onClose();
      if (!editData) {
        setTitle('');
        setDifficulty('E');
        setRelatedStat('STR');
        setTier('Small');
      }
    }, 1000); 
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-abyss border border-system-blue p-6 w-full max-w-sm box-glow relative">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-white"><X /></button>
        
        <h2 className="text-xl font-bold text-white mb-4">{editData ? 'EDIT ENTRY' : 'ADD NEW ENTRY'}</h2>
        
        {!editData && (
          <div className="flex gap-2 mb-4">
            <button onClick={() => setType('quest')} className={`flex-1 py-2 font-bold ${type === 'quest' ? 'bg-system-blue text-black' : 'border border-gray-700 text-gray-500'}`}>QUEST</button>
            <button onClick={() => setType('reward')} className={`flex-1 py-2 font-bold ${type === 'reward' ? 'bg-yellow-500 text-black' : 'border border-gray-700 text-gray-500'}`}>REWARD</button>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-xs text-system-blue uppercase">Name</label>
            <input 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              className="w-full bg-black border border-system-blue/50 p-2 text-white focus:outline-none focus:border-system-blue"
              placeholder={type === 'quest' ? "e.g. Run 5km" : "e.g. New Keyboard"}
            />
          </div>

          {type === 'quest' ? (
            <>
              <div>
                <label className="text-xs text-system-blue uppercase">Difficulty Rank</label>
                <select 
                  value={difficulty} 
                  onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                  className="w-full bg-black border border-system-blue/50 p-2 text-white focus:outline-none"
                >
                  {Object.keys(DIFFICULTY_REWARDS).map(d => <option key={d} value={d}>{d}-Rank</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-system-blue uppercase">Related Stat</label>
                <select 
                  value={relatedStat} 
                  onChange={(e) => setRelatedStat(e.target.value as StatType)}
                  className="w-full bg-black border border-system-blue/50 p-2 text-white focus:outline-none"
                >
                  {['STR', 'VIT', 'INT', 'SEN', 'AGI'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </>
          ) : (
             <div>
              <label className="text-xs text-yellow-500 uppercase">Reward Tier</label>
              <select 
                value={tier} 
                onChange={(e) => setTier(e.target.value as ItemTier)}
                className="w-full bg-black border border-yellow-500/50 p-2 text-white focus:outline-none"
              >
                {Object.keys(TIER_COSTS).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}

          <button 
            onClick={handleSubmit} 
            disabled={!title || isCalculating}
            className="w-full py-3 bg-system-blue text-black font-bold uppercase tracking-widest hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
          >
            {isCalculating ? "CALCULATING..." : "CONFIRM"}
          </button>
        </div>
      </div>
    </div>
  );
};

const BreathingContainer = ({ children, className }: { children: React.ReactNode, className?: string }) => {
  return (
    <motion.div
      animate={{
        borderColor: ["rgba(0, 168, 255, 0.3)", "rgba(0, 168, 255, 0.8)", "rgba(0, 168, 255, 0.3)"],
        boxShadow: [
          "0 0 10px rgba(0, 168, 255, 0.1), inset 0 0 5px rgba(0, 168, 255, 0.05)",
          "0 0 20px rgba(0, 168, 255, 0.3), inset 0 0 15px rgba(0, 168, 255, 0.1)",
          "0 0 10px rgba(0, 168, 255, 0.1), inset 0 0 5px rgba(0, 168, 255, 0.05)"
        ]
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut"
      }}
      className={`border border-system-blue/30 rounded-lg p-4 ${className}`}
    >
      {children}
    </motion.div>
  );
};

// --- Main App Component ---

export default function App() {
  const [state, setState] = useState<PlayerState>(INITIAL_STATE);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showStatModal, setShowStatModal] = useState(false);
  const [penaltyModalOpen, setPenaltyModalOpen] = useState(false);
  const [lootDrop, setLootDrop] = useState<string | null>(null);
  const [statToast, setStatToast] = useState<string | null>(null);
  
  // New UI State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{ index: number, data: any } | null>(null);
  const [viewMode, setViewMode] = useState<'daily' | 'manage'>('daily');

  // Timer State
  const [timerActive, setTimerActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  // Initialization & Daily Reset Logic
  useEffect(() => {
    const loaded = loadState();
    const today = getTodayDate();

    if (loaded.lastActiveDate !== today) {
      // It's a new day!
      const yesterdayQuests = loaded.dailyQuests;
      const allCompleted = yesterdayQuests.length > 0 && yesterdayQuests.every(q => q.isCompleted);
      
      let newState = { ...loaded };
      
      if (!allCompleted && yesterdayQuests.length > 0) {
        // PENALTY DETECTED
        newState.penaltyActive = true;
        newState.dailyQuests = [generatePenaltyQuest()];
        newState.currentStreak = 0; // Reset streak on failure
      } else {
        // Normal reset
        if (allCompleted) {
          newState.currentStreak = (newState.currentStreak || 0) + 1;
        } else {
          newState.currentStreak = 0;
        }

        // Ensure questPool exists
        const pool = (newState.questPool && newState.questPool.length > 0) ? newState.questPool : DEFAULT_QUEST_POOL;
        newState.dailyQuests = generateDailyQuests(pool);
        newState.penaltyActive = false;
      }
      
      newState.lastActiveDate = today;
      setState(newState);
      saveState(newState);
    } else {
      // Even if same day, check if quest list is empty (first run)
      if (loaded.dailyQuests.length === 0) {
        const pool = (loaded.questPool && loaded.questPool.length > 0) ? loaded.questPool : DEFAULT_QUEST_POOL;
        loaded.dailyQuests = generateDailyQuests(pool);
        saveState(loaded);
      }
      setState(loaded);
    }
  }, []);

  // Save on change
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Check Penalty Mode
  useEffect(() => {
    if (state.penaltyActive) {
      setPenaltyModalOpen(true);
      // Initialize timer if applicable
      const penaltyQuest = state.dailyQuests[0];
      if (penaltyQuest && penaltyQuest.duration && penaltyQuest.duration > 0) {
        setTimeLeft(penaltyQuest.duration);
      }
    }
  }, [state.penaltyActive, state.dailyQuests]);

  // Timer Logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Timer finished
            clearInterval(interval);
            completeQuest(state.dailyQuests[0]?.id);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft, state.dailyQuests]);

  const addXp = (amount: number) => {
    setState(prev => {
      let { currentXp, maxXp, level, currentStreak } = prev;
      
      // Apply Streak Multiplier
      const multiplier = 1.0 + ((currentStreak || 0) * 0.05);
      const adjustedAmount = Math.floor(amount * multiplier);
      
      let newXp = currentXp + adjustedAmount;
      let newLevel = level;
      let newMaxXp = maxXp;
      let leveledUp = false;

      while (newXp >= newMaxXp) {
        newXp -= newMaxXp;
        newLevel++;
        newMaxXp = Math.floor(newMaxXp * 1.3);
        leveledUp = true;
      }

      if (leveledUp) {
        setShowLevelUp(true);
        playSystemSound('levelup');
        triggerHaptic('heavy');
        setTimeout(() => setShowLevelUp(false), 3000);
      }

      return {
        ...prev,
        level: newLevel,
        currentXp: newXp,
        maxXp: newMaxXp,
      };
    });
  };

  const completeQuest = (id: string) => {
    if (state.penaltyActive) {
      // Completing penalty quest
      const quest = state.dailyQuests.find(q => q.id === id);
      if (!quest) return;
      
      setTimerActive(false); // Stop timer if running
      playSystemSound('success');
      triggerHaptic('medium');
      
      setState(prev => {
        const pool = (prev.questPool && prev.questPool.length > 0) ? prev.questPool : DEFAULT_QUEST_POOL;
        return {
          ...prev,
          penaltyActive: false,
          dailyQuests: generateDailyQuests(pool), // Give normal quests after penalty
        };
      });
      setPenaltyModalOpen(false);
      return;
    }

    // Check if it's the active dungeon quest
    if (state.activeDungeon && state.activeDungeon.id === id) {
        playSystemSound('success');
        triggerHaptic('heavy');
        setState(prev => {
            const stat = prev.activeDungeon?.relatedStat || 'STR';
            const newStats = { ...prev.stats };
            newStats[stat.toLowerCase() as keyof Stats] += 0.5;
            setStatToast(`${stat} +0.5`);
            setTimeout(() => setStatToast(null), 2000);

            return {
                ...prev,
                gold: prev.gold + (prev.activeDungeon?.goldReward || 0),
                stats: newStats,
                activeDungeon: null, // Clear dungeon
            };
        });
        if (state.activeDungeon) addXp(state.activeDungeon.xpReward);
        return;
    }

    setState(prev => {
      const quests = prev.dailyQuests.map(q => {
        if (q.id === id) return { ...q, isCompleted: !q.isCompleted }; // Toggle
        return q;
      });
      const quest = prev.dailyQuests.find(q => q.id === id);
      const goldReward = quest ? quest.goldReward : 0;
      const xpReward = quest ? quest.xpReward : 0;
      const stat = quest?.relatedStat || 'STR';
      const statKey = stat.toLowerCase() as keyof Stats;
      
      let newGold = prev.gold;
      let newStats = { ...prev.stats };

      if (quest) {
        if (!quest.isCompleted) {
            // Completing
            newGold += goldReward;
            newStats[statKey] += 0.5;
            playSystemSound('success');
            triggerHaptic('medium');
            setStatToast(`${stat} +0.5`);
            setTimeout(() => setStatToast(null), 2000);
        } else {
            // Un-completing
            newGold = Math.max(0, newGold - goldReward);
            newStats[statKey] = Math.max(0, newStats[statKey] - 0.5);
            triggerHaptic('light');
        }
      }

      // Loot Drop Logic (10% chance) - Only on completion
      let newInventory = [...(prev.inventory || [])];
      if (quest && !quest.isCompleted && Math.random() > 0.9) {
          newInventory.push("Instance Dungeon Key");
          setLootDrop("Instance Dungeon Key");
          playSystemSound('levelup'); // Use levelup sound for rare drop
          triggerHaptic('heavy');
      }

      return {
        ...prev,
        gold: newGold,
        stats: newStats,
        dailyQuests: quests,
        inventory: newInventory,
      };
    });

    // Add XP separately to handle leveling logic cleanly
    const quest = state.dailyQuests.find(q => q.id === id);
    if (quest && !quest.isCompleted) {
        addXp(quest.xpReward);
    } else if (quest && quest.isCompleted) {
        setState(prev => ({
            ...prev,
            currentXp: Math.max(0, prev.currentXp - quest.xpReward)
        }));
    }
  };

  const buyItem = (cost: number) => {
    if (state.gold >= cost) {
      playSystemSound('success');
      triggerHaptic('medium');
      setState(prev => ({
        ...prev,
        gold: prev.gold - cost,
      }));
    } else {
      playSystemSound('error');
      triggerHaptic('light');
    }
  };

  const enterDungeon = () => {
      if (state.inventory.includes("Instance Dungeon Key")) {
          playSystemSound('click');
          triggerHaptic('medium');
          const dungeonQuest = generateDungeonQuest();
          setState(prev => ({
              ...prev,
              inventory: prev.inventory.filter((_, i) => i !== prev.inventory.indexOf("Instance Dungeon Key")), // Remove one key
              activeDungeon: dungeonQuest,
          }));
      }
  };

  const handleAddItem = (type: 'quest' | 'reward', data: any) => {
    setState(prev => {
      if (editingItem !== null) {
        // Editing existing item
        if (type === 'quest') {
          const rewards = DIFFICULTY_REWARDS[data.difficulty as Difficulty];
          const updatedQuest = {
            ...prev.questPool[editingItem.index],
            title: data.title,
            xpReward: rewards.xp,
            goldReward: rewards.gold,
            difficulty: data.difficulty,
            relatedStat: data.relatedStat,
          };
          const newPool = [...prev.questPool];
          newPool[editingItem.index] = updatedQuest;
          return { ...prev, questPool: newPool };
        } else {
          // Shop item editing not fully implemented in UI trigger yet, but logic here
          return prev;
        }
      } else {
        // Adding new item
        if (type === 'quest') {
          const rewards = DIFFICULTY_REWARDS[data.difficulty as Difficulty];
          const newQuest = {
            title: data.title,
            xpReward: rewards.xp,
            goldReward: rewards.gold,
            difficulty: data.difficulty,
            relatedStat: data.relatedStat,
          };
          const newPool = [...prev.questPool, newQuest];
          const activeQuest = {
            ...newQuest,
            id: `daily-${Date.now()}`,
            isCompleted: false,
            type: 'daily' as const,
          };
          return {
            ...prev,
            questPool: newPool,
            dailyQuests: [...prev.dailyQuests, activeQuest],
          };
        } else {
          const cost = TIER_COSTS[data.tier as ItemTier];
          const newItem = {
            id: `shop-${Date.now()}`,
            name: data.title,
            cost: cost,
            description: `${data.tier} Reward`,
            tier: data.tier,
          };
          return {
            ...prev,
            shopItems: [...prev.shopItems, newItem],
          };
        }
      }
    });
    setEditingItem(null);
  };

  const handleAddToDaily = (index: number) => {
    setState(prev => {
      const questFromPool = prev.questPool[index];
      const newDailyQuest = {
        ...questFromPool,
        id: `daily-${Date.now()}-${Math.random()}`,
        isCompleted: false,
        type: 'daily' as const,
      };
      return {
        ...prev,
        dailyQuests: [...prev.dailyQuests, newDailyQuest]
      };
    });
    setStatToast("Quest Added to Daily");
    setTimeout(() => setStatToast(null), 2000);
    playSystemSound('click');
  };

  const handleRemoveFromDailyByTitle = (title: string) => {
    setState(prev => {
      const index = prev.dailyQuests.findIndex(q => q.title === title);
      if (index === -1) return prev;
      
      const newDaily = [...prev.dailyQuests];
      newDaily.splice(index, 1);
      return { ...prev, dailyQuests: newDaily };
    });
    triggerHaptic('light');
  };

  const handleRemoveFromDailyById = (id: string) => {
    setState(prev => ({
      ...prev,
      dailyQuests: prev.dailyQuests.filter(q => q.id !== id)
    }));
    triggerHaptic('light');
  };

  const openEditModal = (index: number) => {
    const quest = state.questPool[index];
    setEditingItem({ index, data: { type: 'quest', ...quest } });
    setIsAddModalOpen(true);
  };

  const handleDeleteQuest = (index: number) => {
    setState(prev => {
      const newPool = [...prev.questPool];
      newPool.splice(index, 1);
      return { ...prev, questPool: newPool };
    });
  };

  const handleDeleteShopItem = (id: string) => {
    setState(prev => ({
      ...prev,
      shopItems: prev.shopItems.filter(i => i.id !== id),
    }));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const xpPercentage = Math.min(100, (state.currentXp / state.maxXp) * 100);
  const currentPenaltyQuest = state.dailyQuests[0];
  const hasTimer = currentPenaltyQuest?.duration && currentPenaltyQuest.duration > 0;
  const rank = getRank(state.level);
  const dungeonKeyCount = (state.inventory || []).filter(i => i === "Instance Dungeon Key").length;
  const streakMultiplier = (1.0 + ((state.currentStreak || 0) * 0.05)).toFixed(2);

  return (
    <div className="min-h-screen pb-24 relative font-mono selection:bg-system-blue selection:text-black">
      
      <AddItemModal 
        isOpen={isAddModalOpen} 
        onClose={() => { setIsAddModalOpen(false); setEditingItem(null); }} 
        onAdd={handleAddItem} 
        editData={editingItem?.data}
      />

      {/* --- Stat Toast --- */}
      <AnimatePresence>
        {statToast && (
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -50 }}
                className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50 bg-system-blue text-black px-6 py-2 rounded-full font-bold box-glow-strong"
            >
                {statToast}
            </motion.div>
        )}
      </AnimatePresence>

      {/* --- Loot Drop Overlay --- */}
      <AnimatePresence>
        {lootDrop && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setLootDrop(null)}
          >
            <div className="bg-abyss border-2 border-system-blue p-8 max-w-sm w-full text-center box-glow-strong">
                <Key className="w-16 h-16 text-system-blue mx-auto mb-4 animate-pulse" />
                <h2 className="text-2xl font-bold text-white mb-2">ITEM OBTAINED</h2>
                <p className="text-system-blue text-xl font-bold mb-4">{lootDrop}</p>
                <p className="text-gray-400 text-sm mb-6">Use this key to unlock an Instance Dungeon.</p>
                <button 
                    onClick={() => setLootDrop(null)}
                    className="px-6 py-2 bg-system-blue text-black font-bold rounded hover:scale-105 transition-transform"
                >
                    ACCEPT
                </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Penalty Overlay --- */}
      <AnimatePresence>
        {penaltyModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-red-900/90 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <div className="bg-black border-2 border-red-600 p-8 max-w-md w-full text-center box-glow-red relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-red-500 animate-pulse" />
              <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4 animate-bounce" />
              <h2 className="text-3xl font-bold text-red-500 mb-2 tracking-widest">PENALTY QUEST</h2>
              <p className="text-red-300 mb-6 uppercase">
                You failed to complete your daily tasks. <br/>
                System access is restricted.
              </p>
              
              <div className="bg-red-950/50 border border-red-500/50 p-4 mb-6">
                <p className="text-xl font-bold text-white animate-pulse">
                  {currentPenaltyQuest?.title || "SURVIVE"}
                </p>
                {hasTimer && (
                  <div className="mt-4 text-4xl font-black text-red-500 font-mono">
                    {formatTime(timeLeft)}
                  </div>
                )}
              </div>

              {hasTimer ? (
                <button
                  onClick={() => setTimerActive(true)}
                  disabled={timerActive}
                  className={`w-full py-3 font-bold uppercase tracking-widest transition-all ${
                    timerActive 
                      ? 'bg-red-900/50 text-red-500 cursor-not-allowed' 
                      : 'bg-red-600 hover:bg-red-500 text-white hover:scale-105 active:scale-95'
                  }`}
                >
                  {timerActive ? "SURVIVE..." : "START PENALTY"}
                </button>
              ) : (
                <button
                  onClick={() => completeQuest(currentPenaltyQuest?.id)}
                  className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
                >
                  Complete Penalty
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Level Up Overlay --- */}
      <AnimatePresence>
        {showLevelUp && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none"
          >
            <div className="text-center">
              <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-blue-300 to-blue-600 text-glow filter drop-shadow-lg">
                LEVEL UP!
              </h1>
              <p className="text-2xl text-system-blue mt-4 font-bold tracking-[0.5em]">STATUS RECOVERED</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Main Content --- */}
      <div className="max-w-md mx-auto p-4 space-y-6">
        
        {/* Header / Status Window */}
        <header className="space-y-1">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-xs text-system-blue uppercase tracking-widest mb-1">Player Name</p>
              <h1 className="text-2xl font-bold text-white tracking-wide text-glow">{state.name}</h1>
            </div>
            <div className="text-right">
              <p className="text-xs text-system-blue uppercase tracking-widest mb-1">Level</p>
              <h2 className="text-4xl font-bold text-white text-glow leading-none">{state.level}</h2>
            </div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-xs text-system-blue rounded bg-system-blue/10 box-glow-subtle">
                {state.title}
                </span>
                <span className="px-2 py-0.5 border border-yellow-500/50 text-xs text-yellow-500 rounded bg-yellow-500/10 flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-yellow-500 box-shadow-yellow" />
                {state.gold} G
                </span>
            </div>
            <div className="px-3 py-1 border border-system-blue bg-system-blue/20 rounded text-sm font-bold text-white box-glow animate-pulse">
                {rank}
            </div>
          </div>
        </header>

        {/* XP Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-system-blue/70">
            <span>EXP</span>
            <div className="flex gap-2">
              {state.currentStreak > 0 && (
                <span className="text-orange-500 font-bold animate-pulse">🔥 {state.currentStreak} Day Streak (x{streakMultiplier})</span>
              )}
              <span>{state.currentXp} / {state.maxXp}</span>
            </div>
          </div>
          <div className={`h-4 w-full bg-gray-900 border border-system-blue/30 rounded-sm overflow-hidden relative ${state.currentStreak > 0 ? 'box-glow' : ''}`}>
            <motion.div 
              className={`h-full bg-system-blue ${state.currentStreak > 0 ? 'box-glow-strong' : 'box-glow'}`}
              initial={{ width: 0 }}
              animate={{ width: `${xpPercentage}%` }}
              transition={{ type: "spring", bounce: 0, duration: 1 }}
            />
          </div>
        </div>

        {/* Stats Section */}
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-white border-l-4 border-system-blue pl-3">STATUS</h2>
          </div>

          {/* Radar Chart */}
          <div className="bg-abyss/50 border border-system-blue/20 rounded-lg p-2 box-glow">
            <StatsRadarChart stats={state.stats} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <StatRow label="STR" value={state.stats.str} icon={Shield} />
            <StatRow label="VIT" value={state.stats.vit} icon={Activity} />
            <StatRow label="AGI" value={state.stats.agi} icon={Zap} />
            <StatRow label="INT" value={state.stats.int} icon={Brain} />
            <div className="col-span-2">
                <StatRow label="SEN" value={state.stats.sen} icon={TrendingUp} />
            </div>
          </div>
        </section>

        {/* Dungeon Section */}
        <section className="space-y-4">
            <h2 className="text-lg font-bold text-white border-l-4 border-red-600 pl-3 flex items-center gap-2">
                <Skull className="w-5 h-5 text-red-600" />
                DUNGEON
            </h2>
            
            {state.activeDungeon ? (
                <div className="p-4 border border-red-600 bg-red-950/30 rounded box-glow-red relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-20">
                        <Skull className="w-24 h-24 text-red-500" />
                    </div>
                    <h3 className="text-xl font-bold text-red-500 mb-2">INSTANCE DUNGEON OPEN</h3>
                    <p className="text-white font-bold text-lg mb-4">{state.activeDungeon.title}</p>
                    <div className="flex gap-4 mb-4">
                        <span className="text-system-blue text-sm">XP: +{state.activeDungeon.xpReward}</span>
                        <span className="text-yellow-500 text-sm">GOLD: +{state.activeDungeon.goldReward}</span>
                    </div>
                    <button 
                        onClick={() => completeQuest(state.activeDungeon!.id)}
                        className="w-full py-2 bg-red-600 text-white font-bold uppercase tracking-widest hover:bg-red-500 transition-colors"
                    >
                        COMPLETE DUNGEON
                    </button>
                </div>
            ) : (
                <div className="p-4 border border-gray-800 bg-abyss/50 rounded flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Key className={`w-6 h-6 ${dungeonKeyCount > 0 ? 'text-system-blue animate-pulse' : 'text-gray-600'}`} />
                        <div>
                            <p className="text-white font-bold">Dungeon Keys</p>
                            <p className="text-xs text-gray-500">Required to enter instance dungeons.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-2xl font-mono text-white">{dungeonKeyCount}</span>
                        <button 
                            onClick={enterDungeon}
                            disabled={dungeonKeyCount === 0}
                            className={`px-3 py-1 rounded text-xs font-bold uppercase border ${
                                dungeonKeyCount > 0 
                                ? 'border-system-blue text-system-blue hover:bg-system-blue hover:text-black' 
                                : 'border-gray-700 text-gray-700 cursor-not-allowed'
                            }`}
                        >
                            ENTER
                        </button>
                    </div>
                </div>
            )}
        </section>

        {/* Daily Quests */}
        <section className="space-y-4">
          <div className="flex justify-between items-center border-l-4 border-system-blue pl-3">
            <h2 className="text-lg font-bold text-white">{viewMode === 'daily' ? 'DAILY QUESTS' : 'QUEST POOL'}</h2>
            <button 
              onClick={() => {
                setViewMode(viewMode === 'daily' ? 'manage' : 'daily');
                playSystemSound('click');
                triggerHaptic('light');
              }} 
              className="text-xs text-system-blue hover:text-white flex items-center gap-1 relative z-20 cursor-pointer"
            >
              <Settings className="w-3 h-3" />
              {viewMode === 'daily' ? 'MANAGE' : 'VIEW DAILY'}
            </button>
          </div>
          
          <BreathingContainer className="bg-abyss/50">
            <div className="space-y-2">
              {viewMode === 'daily' ? (
                state.dailyQuests.length === 0 ? (
                  <p className="text-gray-500 text-sm italic">No quests available. Wait for reset.</p>
                ) : (
                  state.dailyQuests.map(quest => (
                    <QuestItem 
                      key={quest.id} 
                      quest={quest} 
                      onComplete={completeQuest} 
                    />
                  ))
                )
              ) : (
                state.questPool.length === 0 ? (
                  <p className="text-gray-500 text-sm italic">Pool is empty.</p>
                ) : (
                  state.questPool.map((quest, i) => {
                    const isInDaily = state.dailyQuests.some(d => d.title === quest.title);
                    return (
                      <QuestItem 
                        key={i} 
                        quest={{ ...quest, id: `pool-${i}`, isCompleted: false, type: 'daily' }} 
                        onAddToDaily={!isInDaily ? () => handleAddToDaily(i) : undefined}
                        onRemoveFromDaily={isInDaily ? () => handleRemoveFromDailyByTitle(quest.title) : undefined}
                        onEdit={() => openEditModal(i)}
                        onDelete={() => handleDeleteQuest(i)}
                      />
                    );
                  })
                )
              )}
            </div>
          </BreathingContainer>
        </section>

        {/* Shop */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-yellow-500" />
            <h2 className="text-lg font-bold text-white">ITEM SHOP</h2>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {state.shopItems.map(item => (
              <ShopItemCard 
                key={item.id} 
                item={item} 
                canAfford={state.gold >= item.cost}
                onBuy={() => buyItem(item.cost)}
                onDelete={() => handleDeleteShopItem(item.id)}
              />
            ))}
          </div>
        </section>

      </div>

      {/* FAB */}
      <button 
        onClick={() => {
          setIsAddModalOpen(true);
          playSystemSound('click');
          triggerHaptic('light');
        }}
        className="fixed bottom-6 right-6 w-14 h-14 bg-system-blue text-black rounded-full flex items-center justify-center box-glow-strong hover:scale-110 active:scale-95 transition-all z-40"
      >
        <Plus className="w-8 h-8" />
      </button>

    </div>
  );
}
