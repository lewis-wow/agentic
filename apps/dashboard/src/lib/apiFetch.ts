import { HttpException, UnknownError } from '@repo/exception';

export type ApiFetchArgs = {
  path: string;
  init?: RequestInit;
};

const NO_CONTENT_STATUS = 204;

export const apiFetch = async <T>(args: ApiFetchArgs): Promise<T> => {
  const res = await fetch(args.path, args.init);

  if (!res.ok) {
    const json = await res.json().catch(() => null);
    const exception =
      HttpException.fromResponse({ json, status: res.status }) ??
      new UnknownError();
    throw exception;
  }

  if (res.status === NO_CONTENT_STATUS) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
};
