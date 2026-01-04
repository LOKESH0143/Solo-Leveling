import { Quest, ShopItem, Difficulty, ItemTier } from './types';

export const DIFFICULTY_REWARDS: Record<Difficulty, { xp: number, gold: number }> = {
  'E': { xp: 10, gold: 5 },
  'D': { xp: 30, gold: 15 },
  'C': { xp: 60, gold: 30 },
  'B': { xp: 100, gold: 60 },
  'A': { xp: 200, gold: 150 },
  'S': { xp: 500, gold: 300 },
};

export const TIER_COSTS: Record<ItemTier, number> = {
  'Small': 100,
  'Medium': 500,
  'Grand': 2000,
  'Life Goal': 10000,
};

export const DEFAULT_QUEST_POOL: Omit<Quest, 'id' | 'isCompleted' | 'type'>[] = [
  { title: "30 min Gym Session", xpReward: 50, goldReward: 20, difficulty: 'C', relatedStat: 'STR' },
  { title: "Read 20 pages C++ Book", xpReward: 30, goldReward: 15, difficulty: 'D', relatedStat: 'INT' },
  { title: "Review Stock Portfolio", xpReward: 30, goldReward: 15, difficulty: 'D', relatedStat: 'SEN' },
  { title: "No Instagram Today", xpReward: 60, goldReward: 30, difficulty: 'C', relatedStat: 'AGI' },
  { title: "Drink 3L Water", xpReward: 10, goldReward: 5, difficulty: 'E', relatedStat: 'VIT' },
  { title: "Solve 1 LeetCode Medium", xpReward: 100, goldReward: 60, difficulty: 'B', relatedStat: 'INT' },
  { title: "10 min Meditation", xpReward: 10, goldReward: 5, difficulty: 'E', relatedStat: 'SEN' },
  { title: "Clean Workspace", xpReward: 10, goldReward: 5, difficulty: 'E', relatedStat: 'AGI' },
  { title: "Journal for 5 mins", xpReward: 10, goldReward: 5, difficulty: 'E', relatedStat: 'SEN' },
  { title: "Walk 5,000 Steps", xpReward: 30, goldReward: 15, difficulty: 'D', relatedStat: 'VIT' },
  { title: "Review AI Paper", xpReward: 60, goldReward: 30, difficulty: 'C', relatedStat: 'INT' },
  { title: "Save $10 Today", xpReward: 10, goldReward: 5, difficulty: 'E', relatedStat: 'SEN' },
];

export const DEFAULT_SHOP_ITEMS: ShopItem[] = [
  { id: '1', name: "1 Hour Gaming Session", cost: 100, description: "Guilt-free gaming time.", tier: 'Small' },
  { id: '2', name: "Buy New Book", cost: 500, description: "Expand your knowledge.", tier: 'Medium' },
  { id: '3', name: "Cheat Meal Weekend", cost: 500, description: "Enjoy a tasty reward.", tier: 'Medium' },
  { id: '4', name: "Movie Night", cost: 100, description: "Relax with a film.", tier: 'Small' },
  { id: '5', name: "New Tech Gadget Fund", cost: 2000, description: "Contribute to the fund.", tier: 'Grand' },
];

export const PENALTY_QUESTS: Omit<Quest, 'id' | 'isCompleted' | 'type'>[] = [
  { title: "Survive 4 Minutes Plank", xpReward: 0, goldReward: 0, duration: 240, relatedStat: 'VIT' },
  { title: "Do 100 Burpees", xpReward: 0, goldReward: 0, duration: 0, relatedStat: 'STR' },
  { title: "Run 5km", xpReward: 0, goldReward: 0, duration: 0, relatedStat: 'VIT' },
];

export const DUNGEON_QUESTS: Omit<Quest, 'id' | 'isCompleted' | 'type'>[] = [
  { title: "Run 10km", xpReward: 300, goldReward: 500, relatedStat: 'VIT' },
  { title: "Code for 4 Hours Straight", xpReward: 300, goldReward: 500, relatedStat: 'INT' },
  { title: "Fast for 16 Hours", xpReward: 300, goldReward: 500, relatedStat: 'SEN' },
  { title: "Complete a Full Project Module", xpReward: 400, goldReward: 600, relatedStat: 'INT' },
  { title: "Read an Entire Book", xpReward: 350, goldReward: 550, relatedStat: 'INT' },
];
