type CtorWith<TArgs extends unknown[]> = new (...args: TArgs) => Error;
export function throwError<TArgs extends unknown[]>(
  args: TArgs,
  { ctor }: { ctor?: CtorWith<TArgs> } = {},
): never {
  throw new ((ctor ?? Error) as CtorWith<TArgs>)(...args);
}
