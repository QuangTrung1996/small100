import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Message, Room, Member, UserSettings } from '../types';
import { translatorService } from '../services/translatorService';

interface AppState {
  // User settings
  settings: UserSettings;
  isSettingsLoaded: boolean;
  
  // Connection state
  userId: string | null;
  isConnected: boolean;
  
  // Room state
  currentRoom: Room | null;
  members: Member[];
  messages: Message[];
  
  // Translator state
  isTranslatorReady: boolean;
  isTranslatorLoading: boolean;
  translatorProgress: number;
  
  // Actions
  loadSettings: () => void;
  saveSettings: (settings: Partial<UserSettings>) => void;
  setUserId: (userId: string | null) => void;
  setConnected: (connected: boolean) => void;
  setRoom: (room: Room | null) => void;
  setMembers: (members: Member[]) => void;
  addMember: (member: Member) => void;
  removeMember: (userId: string) => void;
  updateMember: (member: Member) => void;
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  clearRoom: () => void;
  initTranslator: () => Promise<void>;
  translateMessage: (text: string, sourceLang: string) => Promise<string>;
}

const DEFAULT_SETTINGS: UserSettings = {
  userName: '',
  language: 'en',
  serverUrl: 'ws://localhost:8000/ws',
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      settings: DEFAULT_SETTINGS,
      isSettingsLoaded: false,
      userId: null,
      isConnected: false,
      currentRoom: null,
      members: [],
      messages: [],
      isTranslatorReady: false,
      isTranslatorLoading: false,
      translatorProgress: 0,

      // Actions
      loadSettings: () => {
        set({ isSettingsLoaded: true });
      },

      saveSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }));
      },

      setUserId: (userId) => set({ userId }),

      setConnected: (connected) => set({ isConnected: connected }),

      setRoom: (room) => set({ currentRoom: room }),

      setMembers: (members) => set({ members }),

      addMember: (member) => {
        set((state) => {
          const exists = state.members.some((m) => m.id === member.id);
          if (exists) {
            return {
              members: state.members.map((m) =>
                m.id === member.id ? member : m
              ),
            };
          }
          return { members: [...state.members, member] };
        });
      },

      removeMember: (userId) => {
        set((state) => ({
          members: state.members.filter((m) => m.id !== userId),
        }));
      },

      updateMember: (member) => {
        set((state) => ({
          members: state.members.map((m) =>
            m.id === member.id ? member : m
          ),
        }));
      },

      addMessage: (message) => {
        set((state) => ({
          messages: [...state.messages, message],
        }));
      },

      setMessages: (messages) => set({ messages }),

      clearRoom: () => {
        set({
          currentRoom: null,
          members: [],
          messages: [],
        });
      },

      initTranslator: async () => {
        set({ isTranslatorLoading: true, translatorProgress: 0 });
        
        try {
          await translatorService.initialize((progress) => {
            set({ translatorProgress: progress });
          });
          set({ isTranslatorReady: true });
        } catch (error) {
          console.error('Failed to initialize translator:', error);
        } finally {
          set({ isTranslatorLoading: false });
        }
      },

      translateMessage: async (text, sourceLang) => {
        const { settings, isTranslatorReady } = get();
        
        // Don't translate if same language
        if (sourceLang === settings.language) {
          return text;
        }
        
        // If translator not ready, return original
        if (!isTranslatorReady) {
          return text;
        }
        
        try {
          const translated = await translatorService.translate(
            text,
            sourceLang,
            settings.language
          );
          return translated;
        } catch (error) {
          console.error('Translation failed:', error);
          return text;
        }
      },
    }),
    {
      name: 'chat-app-storage',
      partialize: (state) => ({
        settings: state.settings,
      }),
    }
  )
);
