import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  Timestamp,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  OperationType,
  SUPER_ADMIN_EMAIL,
  auth,
  db,
  gmailProvider,
  googleProvider,
  handleFirestoreError,
} from '../firebase';

let cachedGmailToken: string | null = null;

export const FREE_QUOTA_LIMIT = 3;

export interface UserAccountDoc {
  uid: string;
  email: string;
  displayName: string;
  role: 'user' | 'super_admin';
  paidUntil: Timestamp | null;
  lastRedeemedCode: string | null;
  freeUsed?: number;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

interface AuthContextValue {
  firebaseUser: User | null;
  userDoc: UserAccountDoc | null;
  authReady: boolean;
  isSuperAdmin: boolean;
  hasPaidAccess: boolean;
  freeUsed: number;
  freeRemaining: number;
  canGenerate: boolean;
  authError: string | null;
  hasGmailAccess: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  connectGmail: () => Promise<string>;
  getGmailAccessToken: () => string | null;
  clearGmailToken: () => void;
  redeemLicenseCode: (code: string) => Promise<{ paidUntilDate: Date; durationDays: number }>;
  consumeFreeGeneration: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserAccountDoc | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [hasGmailAccess, setHasGmailAccess] = useState<boolean>(() => Boolean(cachedGmailToken));

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) {
        cachedGmailToken = null;
        setHasGmailAccess(false);
        setUserDoc(null);
        setAuthReady(true);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;

    const userPath = `users/${firebaseUser.uid}`;
    const userRef = doc(db, 'users', firebaseUser.uid);
    let cancelled = false;

    const ensureUserDoc = async () => {
      try {
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          const isOwnerAdmin =
            Boolean(firebaseUser.emailVerified) &&
            firebaseUser.email === SUPER_ADMIN_EMAIL;
          await setDoc(userRef, {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || '',
            role: isOwnerAdmin ? 'super_admin' : 'user',
            paidUntil: null,
            lastRedeemedCode: null,
            freeUsed: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else if (typeof snap.data()?.freeUsed !== 'number') {
          await updateDoc(userRef, {
            freeUsed: 0,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        if (!cancelled) {
          try {
            handleFirestoreError(err, OperationType.WRITE, userPath);
          } catch (formatted) {
            setAuthError(
              formatted instanceof Error ? formatted.message : 'تعذر تهيئة حساب المستخدم.'
            );
          }
        }
      }
    };

    void ensureUserDoc();

    const unsubscribeDoc = onSnapshot(
      userRef,
      (snap) => {
        if (snap.exists()) {
          setUserDoc(snap.data() as UserAccountDoc);
        }
        setAuthReady(true);
      },
      (err) => {
        setAuthReady(true);
        try {
          handleFirestoreError(err, OperationType.GET, userPath);
        } catch (formatted) {
          setAuthError(
            formatted instanceof Error ? formatted.message : 'تعذر قراءة بيانات الاشتراك.'
          );
        }
      }
    );

    return () => {
      cancelled = true;
      unsubscribeDoc();
    };
  }, [firebaseUser]);

  const isSuperAdmin = useMemo(
    () =>
      Boolean(
        firebaseUser &&
          firebaseUser.emailVerified &&
          firebaseUser.email === SUPER_ADMIN_EMAIL
      ),
    [firebaseUser]
  );

  const hasPaidAccess = useMemo(() => {
    if (isSuperAdmin) return true;
    if (!userDoc?.paidUntil) return false;
    return userDoc.paidUntil.toMillis() > Date.now();
  }, [isSuperAdmin, userDoc]);

  const freeUsed = useMemo(() => {
    const raw = userDoc?.freeUsed;
    return typeof raw === 'number' && raw >= 0 ? Math.floor(raw) : 0;
  }, [userDoc]);

  const freeRemaining = useMemo(
    () => (isSuperAdmin ? FREE_QUOTA_LIMIT : Math.max(0, FREE_QUOTA_LIMIT - freeUsed)),
    [isSuperAdmin, freeUsed]
  );

  const canGenerate = useMemo(
    () => Boolean(firebaseUser) && (hasPaidAccess || freeRemaining > 0),
    [firebaseUser, hasPaidAccess, freeRemaining]
  );

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'تعذر تسجيل الدخول عبر Google.';
      if (!message.includes('popup-closed-by-user')) {
        setAuthError('تعذر إتمام تسجيل الدخول. تأكد من السماح بالنوافذ المنبثقة وحاول مرة أخرى.');
      }
    }
  }, []);

  const signOutUser = useCallback(async () => {
    setAuthError(null);
    cachedGmailToken = null;
    setHasGmailAccess(false);
    await signOut(auth);
  }, []);

  const connectGmail = useCallback(async (): Promise<string> => {
    setAuthError(null);
    const result = await signInWithPopup(auth, gmailProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('لم يتم منح إذن إرسال البريد عبر Gmail. يرجى المحاولة مجدداً والموافقة على الصلاحية.');
    }
    cachedGmailToken = credential.accessToken;
    setHasGmailAccess(true);
    return cachedGmailToken;
  }, []);

  const getGmailAccessToken = useCallback(() => cachedGmailToken, []);

  const clearGmailToken = useCallback(() => {
    cachedGmailToken = null;
    setHasGmailAccess(false);
  }, []);

  const redeemLicenseCode = useCallback(
    async (rawCode: string): Promise<{ paidUntilDate: Date; durationDays: number }> => {
      if (!firebaseUser) {
        throw new Error('يرجى تسجيل الدخول بحساب Google أولاً.');
      }

      const codeId = rawCode.trim().toUpperCase();
      if (!/^[A-Z0-9\-]{4,32}$/.test(codeId)) {
        throw new Error('صيغة الكود غير صحيحة. مثال: K7P2-9XQ4');
      }

      const codePath = `codes/${codeId}`;
      const codeRef = doc(db, 'codes', codeId);

      let snap;
      try {
        snap = await getDoc(codeRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, codePath);
      }

      if (!snap.exists()) {
        throw new Error('كود التفعيل غير صحيح أو غير موجود.');
      }

      const codeData = snap.data() as {
        used?: boolean;
        durationDays?: number;
      };

      if (codeData.used === true) {
        throw new Error('تم استخدام هذا الكود مسبقاً ولا يمكن استخدامه لحساب آخر.');
      }

      const durationDays =
        typeof codeData.durationDays === 'number' && codeData.durationDays >= 1
          ? Math.min(3650, Math.floor(codeData.durationDays))
          : 30;

      const currentPaidMs =
        userDoc?.paidUntil && userDoc.paidUntil.toMillis() > Date.now()
          ? userDoc.paidUntil.toMillis()
          : Date.now();

      const nextPaidUntilDate = new Date(currentPaidMs + durationDays * 86400 * 1000);
      const nextPaidUntil = Timestamp.fromDate(nextPaidUntilDate);

      const batch = writeBatch(db);
      batch.update(codeRef, {
        used: true,
        usedBy: firebaseUser.uid,
        usedByEmail: firebaseUser.email || '',
        usedAt: serverTimestamp(),
      });
      const userUpdatePayload: {
        paidUntil: Timestamp;
        lastRedeemedCode: string;
        updatedAt: ReturnType<typeof serverTimestamp>;
        freeUsed?: number;
      } = {
        paidUntil: nextPaidUntil,
        lastRedeemedCode: codeId,
        updatedAt: serverTimestamp(),
      };
      if (typeof userDoc?.freeUsed !== 'number') {
        userUpdatePayload.freeUsed = 0;
      }
      batch.update(doc(db, 'users', firebaseUser.uid), userUpdatePayload);

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `${codePath} + users/${firebaseUser.uid}`);
      }

      return { paidUntilDate: nextPaidUntilDate, durationDays };
    },
    [firebaseUser, userDoc]
  );

  const consumeFreeGeneration = useCallback(async () => {
    if (!firebaseUser || isSuperAdmin || hasPaidAccess) return;
    const currentUsed =
      typeof userDoc?.freeUsed === 'number' && userDoc.freeUsed >= 0
        ? Math.floor(userDoc.freeUsed)
        : 0;
    if (currentUsed >= FREE_QUOTA_LIMIT) return;

    const userPath = `users/${firebaseUser.uid}`;
    try {
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        freeUsed: currentUsed + 1,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, userPath);
    }
  }, [firebaseUser, isSuperAdmin, hasPaidAccess, userDoc]);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userDoc,
        authReady,
        isSuperAdmin,
        hasPaidAccess,
        freeUsed,
        freeRemaining,
        canGenerate,
        authError,
        hasGmailAccess,
        signInWithGoogle,
        signOutUser,
        connectGmail,
        getGmailAccessToken,
        clearGmailToken,
        redeemLicenseCode,
        consumeFreeGeneration,
        getIdToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
