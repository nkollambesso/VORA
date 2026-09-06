declare module 'express' {
  export interface Request {
    body?: any;
    params?: any;
    query?: any;
    headers?: any;
    [key: string]: any;
  }
  export interface Response {
    status(code: number): Response;
    json(data: any): Response;
    send(data: any): Response;
    [key: string]: any;
  }
  export interface Router {
    get(path: string, ...handlers: any[]): Router;
    post(path: string, ...handlers: any[]): Router;
    put(path: string, ...handlers: any[]): Router;
    delete(path: string, ...handlers: any[]): Router;
    use(...args: any[]): Router;
    [key: string]: any;
  }
  export function Router(): Router;
  const express: any;
  export default express;
}

declare module 'cors';
declare module 'socket.io';
declare module 'http';
declare module 'pg';
declare module 'dotenv';

declare namespace NodeJS {
  interface ProcessEnv {
    [key: string]: string | undefined;
  }
}
