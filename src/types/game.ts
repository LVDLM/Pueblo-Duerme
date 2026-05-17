export type GamePhase = 
  | 'lobby' 
  | 'night_start' 
  | 'cupid_turn' 
  | 'werewolves_turn' 
  | 'witch_turn' 
  | 'day_reveal' 
  | 'day_vote' 
  | 'ended';

export type Role = 'villager' | 'werewolf' | 'witch' | 'cupid';

export interface NightTargets {
  werewolfTarget?: string;
  witchHeal?: boolean;
  witchKill?: string;
  cupidCouples?: string[];
}

export interface Game {
  id: string;
  lobbyCode: string;
  status: 'waiting' | 'playing' | 'ended';
  phase: GamePhase;
  narration: string;
  moderatorId: string;
  winner?: 'aldeanos' | 'lobos';
  nightTargets?: NightTargets;
  witchHealUsed?: boolean;
  witchPoisonUsed?: boolean;
  cupidUsed?: boolean;
  lastStartTime?: number;
  lastSleepTime?: number;
  lastWakeUpTime?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Player {
  id: string;
  uid: string;
  displayName: string;
  isAlive: boolean;
  isModerator: boolean;
  isBot?: boolean;
  vote?: string;
  joinedAt: number;
  revealedRole?: Role;
  revealedCardUrl?: string;
}

export interface PlayerSecret {
  role: Role;
  cardUrl?: string;
  isEnamorado: boolean;
  loverId?: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  type: 'public' | 'werewolf';
  phase?: GamePhase;
}
