import server from '../worker/index.js';

export const onRequest = (context) => server.fetch(context.request, context.env);
