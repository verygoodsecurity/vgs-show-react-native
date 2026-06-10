declare module "react" {
  export type ReactNode = unknown;
  export type RefCallback<T> = (instance: T | null) => void;
  export type RefObject<T> = { current: T | null };
  export type Ref<T> = RefCallback<T> | RefObject<T> | null;
  export type RefAttributes<T> = { ref?: Ref<T> | undefined };
  export type ForwardRefExoticComponent<Props> = (props: Props) => ReactNode;

  export function createElement(
    type: unknown,
    props?: Record<string, unknown> | null,
    ...children: unknown[]
  ): unknown;

  export function forwardRef<T, Props = {}>(
    render: (props: Props, ref: Ref<T>) => ReactNode
  ): ForwardRefExoticComponent<Props & RefAttributes<T>>;

  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useImperativeHandle<Ref>(
    ref: unknown,
    create: () => Ref,
    deps?: readonly unknown[]
  ): void;
  export function useRef<T>(initialValue: T): { current: T };
  export function useState<T>(initialValue: T): [T, (value: T | ((previous: T) => T)) => void];
}
