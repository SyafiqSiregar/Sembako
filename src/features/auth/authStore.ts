import { create } from 'zustand';
import { db, type User, type Role, type CashierSession } from '@/data/db';
import { AuthService, type ActiveUserOption } from '@/services/auth.service';
import { CashierSessionService } from '@/services/session.service';
import { type RoleCode } from '@/domain/permissions';

interface AuthState {
  currentUser: User | null;
  roles: Role[];
  roleCodes: RoleCode[];
  isLocked: boolean;
  startInUserSelect: boolean;
  activeSession: CashierSession | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  listActiveUsers: () => Promise<ActiveUserOption[]>;
  login: (userId: string, pin: string) => Promise<boolean>;
  logout: () => void;
  lockScreen: (options?: { selectUser?: boolean }) => void;
  unlockScreen: (pin: string) => Promise<boolean>;
  openSession: (openingCash: number) => Promise<void>;
  closeSession: (closingCash: number, notes?: string) => Promise<{ discrepancy: number; expectedCash: number }>;
  getExpectedCash: (sessionId: string) => Promise<number>;
  clearError: () => void;
}

const authService = new AuthService(db);
const sessionService = new CashierSessionService(db);

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: null,
  roles: [],
  roleCodes: [],
  isLocked: false,
  startInUserSelect: false,
  activeSession: null,
  isLoading: false,
  error: null,

  initialize: async () => {
    set({ isLoading: true, error: null });
    try {
      // Pastikan ada setidaknya 1 user Owner bawaan jika db baru
      const userCount = await db.users.count();
      if (userCount === 0) {
        await authService.createUser({
          name: 'Budi (Owner)',
          pin: '123456',
          roleCode: 'owner',
          createdBy: 'system',
        });
      }

      // Ambil user pertama sebagai user default
      const defaultUser = await db.users.where('status').equals('active').first();
      if (defaultUser) {
        const sessionData = await authService.getUserSessionData(defaultUser.id);
        const activeSession = await sessionService.getActiveSession();

        set({
          currentUser: sessionData.user,
          roles: sessionData.roles,
          roleCodes: sessionData.roleCodes,
          activeSession: activeSession || null,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  login: async (userId: string, pin: string) => {
    set({ isLoading: true, error: null });
    try {
      const sessionData = await authService.verifyLogin(userId, pin);
      const activeSession = await sessionService.getActiveSession();
      set({
        currentUser: sessionData.user,
        roles: sessionData.roles,
        roleCodes: sessionData.roleCodes,
        activeSession: activeSession || null,
        isLocked: false,
        isLoading: false,
      });
      return true;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return false;
    }
  },

  listActiveUsers: async () => {
    return authService.listActiveUsers();
  },

  logout: () => {
    set({
      currentUser: null,
      roles: [],
      roleCodes: [],
      isLocked: false,
      startInUserSelect: false,
    });
  },

  lockScreen: (options?: { selectUser?: boolean }) => {
    set({ isLocked: true, startInUserSelect: !!options?.selectUser, error: null });
  },

  unlockScreen: async (pin: string) => {
    const { currentUser } = get();
    if (!currentUser) return false;

    set({ isLoading: true, error: null });
    try {
      await authService.verifyLogin(currentUser.id, pin);
      set({ isLocked: false, isLoading: false });
      return true;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return false;
    }
  },

  openSession: async (openingCash: number) => {
    const { currentUser } = get();
    if (!currentUser) throw new Error('Harap login terlebih dahulu');

    set({ isLoading: true, error: null });
    try {
      const session = await sessionService.openSession({
        userId: currentUser.id,
        openingCash,
      });
      set({ activeSession: session, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  closeSession: async (closingCash: number, notes?: string) => {
    const { activeSession, currentUser } = get();
    if (!activeSession || !currentUser) {
      throw new Error('Tidak ada sesi kasir yang sedang aktif');
    }

    set({ isLoading: true, error: null });
    try {
      const result = await sessionService.closeSession({
        sessionId: activeSession.id,
        closingCash,
        notes,
        closedBy: currentUser.id,
      });

      set({ activeSession: null, isLoading: false });
      return {
        discrepancy: result.discrepancy,
        expectedCash: result.expectedCash,
      };
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  getExpectedCash: async (sessionId: string) => {
    return sessionService.calculateExpectedCash(sessionId);
  },

  clearError: () => set({ error: null }),
}));
