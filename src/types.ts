export type Difficulty = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
export type ItemTier = 'Small' | 'Medium' | 'Grand' | 'Life Goal';
export type StatType = 'STR' | 'VIT' | 'INT' | 'SEN' | 'AGI';

export interface Stats {
  str: number;
  vit: number;
  int: number;
  sen: number;
  agi: number;
}

export interface Quest {
  id: string;
  title: string;
  xpReward: number;
  goldReward: number;
  isCompleted: boolean;
  type: 'daily' | 'penalty';
  duration?: number; // Duration in seconds for timed quests
  difficulty?: Difficulty; // For tracking rank
  relatedStat: StatType; // Activity-based growth
}

export interface ShopItem {
  id: string;
  name: string;
  cost: number;
  description: string;
  tier?: ItemTier;
}

export interface PlayerState {
  name: string;
  title: string;
  level: number;
  currentXp: number;
  maxXp: number;
  gold: number;
  stats: Stats;
  lastActiveDate: string; // ISO Date string YYYY-MM-DD
  dailyQuests: Quest[];
  penaltyActive: boolean;
  inventory: string[];
  activeDungeon: Quest | null;
  // Dynamic Pools
  questPool: Omit<Quest, 'id' | 'isCompleted' | 'type'>[];
  shopItems: ShopItem[];
  currentStreak: number;
}

export const INITIAL_STATE: PlayerState = {
  name: "Lokesh",
  title: "The Awakening One",
  level: 1,
  currentXp: 0,
  maxXp: 200,
  gold: 0,
  stats: {
    str: 10,
    vit: 10,
    int: 10,
    sen: 10,
    agi: 10,
  },
  lastActiveDate: new Date().toISOString().split('T')[0],
  dailyQuests: [],
  penaltyActive: false,
  inventory: [],
  activeDungeon: null,
  questPool: [], // Will be populated from default constants if empty on load
  shopItems: [], // Will be populated from default constants if empty on load
  currentStreak: 0,
};
