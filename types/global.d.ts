declare module "@clerk/clerk-expo";
declare module "expo-router";
declare module "react-native-modal";
declare module "react-native-google-places-autocomplete";
declare module "react-native-maps";
declare module "react-native-maps-directions";

declare module "react" {
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

declare module "react-native" {
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
  export default any;
}

declare module "expo-location";

declare const process: {
  env: {
    [key: string]: string | undefined;
  };
};

declare namespace NodeJS {
  interface ProcessEnv {
    [key: string]: string | undefined;
  }
}

