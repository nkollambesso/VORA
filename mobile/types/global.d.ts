/**
 * VORA — Global ambient type declarations
 *
 * This file patches:
 *  1. react-native named exports missing from @types/react-native 0.74
 *  2. @stripe/stripe-react-native types missing from v0.37.2
 *  3. Module declarations for deep react-native internal paths
 *  4. Third-party modules with no type declarations
 *
 * Add future missing types here rather than scattering `declare module`
 * statements across individual files.
 */

// ── Third-party modules with no types ────────────────────────────────────────
declare module '@clerk/clerk-expo';
declare module 'expo-router';
declare module 'react-native-modal';
declare module 'react-native-google-places-autocomplete';
declare module 'react-native-maps';
declare module 'react-native-maps-directions';
declare module 'expo-location';

// ── react native ──────────────────────────────────────────────────────────────
// Augment the official module declaration to add missing named exports
declare module 'react-native' {
  export const View: any;
  export const Text: any;
  export const Image: any;
  export const TouchableOpacity: any;
  export const ScrollView: any;
  export const FlatList: any;
  export const TextInput: any;
  export const ActivityIndicator: any;
  export const Alert: any;
  export const Switch: any;
  export const RefreshControl: any;
  export const StyleSheet: any;
  export const Dimensions: any;
  export const Platform: any;
  export const SafeAreaView: any;
  export const KeyboardAvoidingView: any;
  export const Modal: any;
  export const Pressable: any;
  export const Linking: any;
  export const StatusBar: any;
  export const LogBox: any;
  // Missing from @types/react-native in SDK 51
  export function useWindowDimensions(): {
    width: number;
    height: number;
    scale: number;
    fontScale: number;
  };
  export default any;
}

// ── react ─────────────────────────────────────────────────────────────────────
declare module 'react' {
  export function useState<T = any>(initialState?: T | (() => T)): [T, (newState: T | ((prev: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
  export function useRef<T = any>(initialValue?: T): { current: T };
  export function useMemo<T = any>(factory: () => T, deps: any[]): T;
  export type ReactNode = any;
  export type FC<P = {}> = (props: P) => any;
  const React: any;
  export default React;
}

// ── @stripe/stripe-react-native ───────────────────────────────────────────────
// v0.37.2 doesn't export IntentCreationCallbackParams at top level
declare module '@stripe/stripe-react-native' {
  export namespace PaymentMethod {
    interface Result {
      id: string;
      type: string;
      liveMode: boolean;
      customerId?: string;
      billingDetails?: Record<string, any>;
      card?: Record<string, any>;
    }
  }
  export interface IntentCreationCallbackParams {
    clientSecret: string;
    error?: {
      code: string;
      message: string;
      localizedMessage?: string;
    };
  }
  export const StripeProvider: any;
  export function useStripe(): {
    initPaymentSheet: (params: any) => Promise<{ error?: any }>;
    presentPaymentSheet: () => Promise<{ error?: any }>;
    [key: string]: any;
  };
}

// ── react-native internal deep paths ─────────────────────────────────────────
// Metro resolves these at runtime; we only need TS to stop complaining.
declare module 'react-native/Libraries/Utilities/useWindowDimensions' {
  const useWindowDimensions: () => {
    width: number;
    height: number;
    scale: number;
    fontScale: number;
  };
  export default useWindowDimensions;
}
declare module 'react-native/Libraries/StyleSheet/PlatformColorValueTypes' {
  export const PlatformColor: (...names: string[]) => object;
  export const normalizeColorObject: (color: object) => object | null;
  export const processColorObject: (color: object) => object;
}
declare module 'react-native/Libraries/Utilities/LoadingView' { const m: any; export default m; }
declare module 'react-native/Libraries/Alert/RCTAlertManager' { const m: any; export default m; }
declare module 'react-native/Libraries/Core/setUpBatchedBridge' {}
declare module 'react-native/Libraries/NativeComponent/BaseViewConfig' { const m: any; export default m; }

// ── Process / NodeJS ─────────────────────────────────────────────────────────
declare const process: { env: { [key: string]: string | undefined } };
declare namespace NodeJS {
  interface ProcessEnv { [key: string]: string | undefined }
}
