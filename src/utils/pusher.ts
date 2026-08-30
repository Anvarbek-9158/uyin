import Pusher from 'pusher-js';
import { getClientId, getSessionToken } from './api';

// Shared Pusher client for the whole app. It is configured with an auth
// endpoint so both public game channels and private chat channels can be
// subscribed to. The clientId AND its session token are attached dynamically
// (via paramsProvider) so the server can prove the client owns that clientId
// before authorizing private chat subscriptions. NOTE: they must NOT go in
// `auth.params` — pusher-js serializes those values as-is (function sources
// would be sent instead of their results); only `paramsProvider` is evaluated
// at request time.
export const pusher = new Pusher(import.meta.env.VITE_PUSHER_KEY || '307958d4cd4d6d38e210', {
  cluster: import.meta.env.VITE_PUSHER_CLUSTER || 'ap2',
  channelAuthorization: {
    transport: 'ajax',
    endpoint: '/api/pusher/auth',
    paramsProvider: () => ({
      clientId: getClientId(),
      sessionToken: getSessionToken() || '',
    }),
  },
});

export const chatChannelName = (pin: string, studentId: string) =>
  `private-chat-${pin}-${studentId}`;

// Group chat channels are namespaced with "g-" so the server can tell a
// group room from a private student room in /api/pusher/auth.
export const groupChatChannelName = (pin: string, teamId: string) =>
  `private-chat-${pin}-g-${teamId}`;

// Teacher-private channel: carries the FULL (unsanitized) game state so the
// teacher always sees the question, the correct answer and every team's answer.
// Students subscribe to the shared public `game-<pin>` channel, which only ever
// receives the sanitized state (see buildStudentSafeGameState on the server).
export const teacherGameChannelName = (pin: string) => `private-teacher-${pin}`;
