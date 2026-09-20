import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLang, translateServerError } from '../i18n';
import type { Channel } from 'pusher-js';
import { ChatMessage, Student, Team } from '../types';
import { apiPost, apiGet } from '../utils/api';
import { pusher, chatChannelName, groupChatChannelName } from '../utils/pusher';
import {
  MessageSquare,
  MessagesSquare,
  Send,
  X,
  Crown,
  Users,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

interface ChatSectionProps {
  clientId: string;
  pin: string;
  isTeacher: boolean;
  students?: Record<string, Student>;
  teams?: Record<string, Team>;
  groupId?: string | null;
  onClose?: () => void;
}

interface StudentGroup {
  key: string;
  label: string;
  color: string;
  students: Student[];
}

// A chat "room". Private rooms are 1:1 student <-> teacher (roomId = student
// id); group rooms are shared by every member of one team (roomId = team id).
// roomKey is a stable map key that never collides between the two kinds.
type ChatRoom =
  | { roomType: 'private'; roomKey: string; studentId: string }
  | { roomType: 'group'; roomKey: string; teamId: string };

const roomChannelName = (pin: string, room: ChatRoom) =>
  room.roomType === 'group'
    ? groupChatChannelName(pin, room.teamId)
    : chatChannelName(pin, room.studentId);

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });

const lastMessagePreview = (msgs: ChatMessage[] | undefined, t: (k: string) => string): string | null => {
  const last = msgs && msgs.length > 0 ? msgs[msgs.length - 1] : null;
  if (!last) return null;
  const prefix = last.role === 'teacher' ? `${t('chat_teacher_role')}: ` : `${last.senderName}: `;
  return prefix + last.text;
};

const MessageBubble: React.FC<{
  msg: ChatMessage;
  mine: boolean;
  showSender: boolean;
}> = ({ msg, mine, showSender }) => {
  const { t } = useLang();
  return (
  <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
    <div
      className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm break-words leading-snug shadow-lg ${
        mine
          ? 'bg-brand-600 text-ink rounded-br-md border border-brand-300'
          : 'bg-surface-sunken text-surface-raised rounded-bl-md border border-line'
      }`}
    >
      {showSender &&
        (msg.role === 'teacher' ? (
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs font-black uppercase tracking-wider text-warn-400">
              {t('chat_teacher_role')}
            </span>
            <Crown className="w-3 h-3 text-warn-400" />
          </div>
        ) : (
          <div className="flex items-center gap-1 mb-1">
            <span className="text-xs font-black uppercase tracking-wider text-sky-400 truncate max-w-[120px]">
              {msg.senderName}
            </span>
          </div>
        ))}
      <p className="text-[13px]">{msg.text}</p>
      <div
        className={`mt-1 text-xs ${
          mine ? 'text-brand-300' : 'text-ink-faint'
        }`}
      >
        {formatTime(msg.createdAt)}
      </div>
    </div>
  </div>
  );
};

export const ChatSection: React.FC<ChatSectionProps> = ({
  clientId,
  pin,
  isTeacher,
  students = {},
  teams = {},
  groupId = null,
  onClose,
}) => {
  const { lang, t } = useLang();
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownTimerRef = useRef<number | null>(null);

  // Rate-limit cooldown: when the server answers 429 we block the send button
  // for the reported retry-after window so the user cannot keep hammering it.
  const startCooldown = (ms: number) => {
    if (cooldownTimerRef.current !== null) window.clearInterval(cooldownTimerRef.current);
    const totalSec = Math.max(1, Math.ceil(ms / 1000));
    let remaining = totalSec;
    setCooldown(remaining);
    cooldownTimerRef.current = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (cooldownTimerRef.current !== null) window.clearInterval(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
        setCooldown(0);
      } else {
        setCooldown(remaining);
      }
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current !== null) window.clearInterval(cooldownTimerRef.current);
    };
  }, []);

  const channelsRef = useRef<Record<string, Channel | null>>(
    {}
  ) as unknown as { current: Record<string, Channel | null> };
  const loadedRef = useRef<Record<string, boolean>>({});
  const selectedRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    selectedRef.current = selectedKey;
  }, [selectedKey]);

  // Reset the "already loaded history" flags whenever the game changes.
  useEffect(() => {
    loadedRef.current = {};
  }, [pin]);

  const subscribe = useCallback(
    (room: ChatRoom, teacher: boolean) => {
      const name = roomChannelName(pin, room);
      if (channelsRef.current[name]) return;

      const ch = pusher.subscribe(name);
      channelsRef.current[name] = ch;

      const handler = (msg: ChatMessage) => {
        setMessages((prev) => {
          const existing = prev[room.roomKey] || [];
          if (existing.some((m) => m.id === msg.id)) return prev;
          return { ...prev, [room.roomKey]: [...existing, msg] };
        });
        if (selectedRef.current !== room.roomKey && msg.senderId !== clientId) {
          setUnread((prev) => ({ ...prev, [room.roomKey]: (prev[room.roomKey] || 0) + 1 }));
        }
      };

      ch.bind('chat_message', handler);
      ch.bind('pusher:subscription_error', () => {
        setErrorMsg(t('chat_error_connect'));
      });
    },
    [pin, clientId]
  );

  // Unsubscribe all channels when the game changes / on unmount.
  useEffect(() => {
    const all = channelsRef.current;
    return () => {
      Object.values(all).forEach((ch) => ch && ch.unbind('chat_message'));
      Object.keys(all).forEach((name) => {
        const ch = all[name];
        if (ch) pusher.unsubscribe(name);
      });
      channelsRef.current = {};
    };
  }, [pin]);

  // Subscribe to the rooms the caller is allowed to see:
  //   - teacher: every private room + every group room (teams with members)
  //   - student: own private room + own group's room
  useEffect(() => {
    if (!pin) return;
    if (isTeacher) {
      Object.keys(students).forEach((stuId) =>
        subscribe({ roomType: 'private', roomKey: `s:${stuId}`, studentId: stuId }, true)
      );
      Object.keys(teams).forEach((tid) => {
        if ((teams[tid].memberIds || []).some((id) => Boolean(students[id]))) {
          subscribe({ roomType: 'group', roomKey: `g:${tid}`, teamId: tid }, true);
        }
      });
    } else {
      subscribe({ roomType: 'private', roomKey: `s:${clientId}`, studentId: clientId }, false);
      if (groupId) {
        subscribe({ roomType: 'group', roomKey: `g:${groupId}`, teamId: groupId }, false);
      }
    }
  }, [pin, isTeacher, clientId, students, teams, groupId, subscribe]);

  const fetchHistory = useCallback(
    async (room: ChatRoom) => {
      if (loadedRef.current[room.roomKey]) return;
      loadedRef.current[room.roomKey] = true;
      setLoadingHistory(true);
      try {
        const qs =
          room.roomType === 'group'
            ? `pin=${encodeURIComponent(pin)}&clientId=${encodeURIComponent(
                clientId
              )}&roomType=group&teamId=${encodeURIComponent(room.teamId)}`
            : `pin=${encodeURIComponent(pin)}&clientId=${encodeURIComponent(
                clientId
              )}&studentId=${encodeURIComponent(room.studentId)}`;
        const res = await apiGet<{ success: boolean; messages?: ChatMessage[] }>(
          `/api/chat/messages?${qs}`
        );
        if (res?.success && res.messages) {
          setMessages((prev) => {
            const existing = new Set((prev[room.roomKey] || []).map((m) => m.id));
            const merged = [...(prev[room.roomKey] || [])];
            res.messages!.forEach((m) => {
              if (!existing.has(m.id)) merged.push(m);
            });
            merged.sort((a, b) => a.createdAt - b.createdAt);
            return { ...prev, [room.roomKey]: merged };
          });
        } else {
          setErrorMsg(translateServerError(lang, (res as { message?: string }).message) || t('chat_error_load'));
        }
      } finally {
        setLoadingHistory(false);
      }
    },
    [pin, clientId]
  );

  // Student: load own private + own group history once per game.
  useEffect(() => {
    if (!pin || isTeacher) return;
    fetchHistory({ roomType: 'private', roomKey: `s:${clientId}`, studentId: clientId });
    if (groupId) {
      fetchHistory({ roomType: 'group', roomKey: `g:${groupId}`, teamId: groupId });
    }
  }, [pin, isTeacher, clientId, groupId, fetchHistory]);

  // Teacher: load history when a room is opened.
  const selectedRoom: ChatRoom | null = selectedKey
    ? selectedKey.startsWith('g:')
      ? { roomType: 'group', roomKey: selectedKey, teamId: selectedKey.slice(2) }
      : { roomType: 'private', roomKey: selectedKey, studentId: selectedKey.slice(2) }
    : null;

  useEffect(() => {
    if (!pin || !isTeacher || !selectedRoom) return;
    fetchHistory(selectedRoom);
  }, [pin, isTeacher, selectedRoom?.roomKey, fetchHistory]);

  const studentList = Object.values(students) as Student[];
  const teamList = Object.values(teams) as Team[];

  // Group rooms the teacher can open (teams that currently have members).
  const groupRooms: Extract<ChatRoom, { roomType: 'group' }>[] = teamList
    .filter((t) => (t.memberIds || []).some((id) => Boolean(students[id])))
    .map((t) => ({ roomType: 'group' as const, roomKey: `g:${t.id}`, teamId: t.id }));

  const groups: StudentGroup[] = (() => {
    const result: StudentGroup[] = [];
    const unassigned = studentList.filter((s) => !s.teamId);
    if (unassigned.length > 0) {
      result.push({ key: 'unassigned', label: t('chat_no_group'), color: '#94a3b8', students: unassigned });
    }
    teamList.forEach((t) => {
      const members = t.memberIds
        .map((id) => students[id])
        .filter((s): s is Student => Boolean(s));
      if (members.length > 0) {
        result.push({ key: t.id, label: t.name, color: t.color, students: members });
      }
    });
    return result;
  })();

  // Teacher: auto-select the first available room (group chats first).
  useEffect(() => {
    if (!isTeacher || selectedKey) return;
    const first: ChatRoom | null =
      groupRooms[0] ||
      (studentList.length > 0
        ? { roomType: 'private', roomKey: `s:${studentList[0].id}`, studentId: studentList[0].id }
        : null);
    if (first) {
      setSelectedKey(first.roomKey);
      setUnread((prev) => ({ ...prev, [first.roomKey]: 0 }));
    }
  }, [isTeacher, selectedKey, groupRooms, studentList]);

  const openRoom = (roomKey: string) => {
    setSelectedKey(roomKey);
    setUnread((prev) => ({ ...prev, [roomKey]: 0 }));
  };

  // Auto-scroll to the newest message.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, selectedKey]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !selectedRoom || sending || cooldown > 0) return;

    setErrorMsg(null);
    setSending(true);
    const body =
      selectedRoom.roomType === 'group'
        ? { clientId, text, roomType: 'group', teamId: selectedRoom.teamId }
        : { clientId, text, studentId: selectedRoom.studentId };
    const res = await apiPost<{
      success: boolean;
      message?: ChatMessage | string;
      retryAfterMs?: number;
    }>('/api/chat/send', body);
    setSending(false);

    if (res?.success && res.message && typeof res.message !== 'string') {
      const msg = res.message as ChatMessage;
      setMessages((prev) => {
        const existing = prev[selectedRoom.roomKey] || [];
        if (existing.some((m) => m.id === msg.id)) return prev;
        return { ...prev, [selectedRoom.roomKey]: [...existing, msg] };
      });
      setInputText('');
    } else {
      setErrorMsg(translateServerError(lang, (res as { message?: string }).message) || t('chat_error_send'));
      const retryAfterMs = (res as { retryAfterMs?: number }).retryAfterMs;
      if (retryAfterMs) startCooldown(retryAfterMs);
    }
  };

  const renderInput = (placeholder: string) => (
    <div className="p-4 border-t border-line bg-surface-sunken">
      <div className="flex items-center gap-2">
        <input
          data-testid="chat-input"
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={placeholder}
          maxLength={1000}
          className="flex-1 px-4 py-3 rounded-xl bg-surface border border-line text-ink text-sm placeholder:text-ink-faint focus:outline-none focus:border-brand-500"
        />
        <button
          data-testid="chat-send"
          onClick={handleSend}
          disabled={!inputText.trim() || sending || cooldown > 0}
          className="p-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-ink disabled:opacity-40 transition-all cursor-pointer shrink-0"
          aria-label={t('chat_send_aria')}
        >
          {sending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : cooldown > 0 ? (
            <span className="text-xs font-black tabular-nums">{cooldown}s</span>
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );

  const renderError = () =>
    errorMsg && (
      <div className="px-4 pb-2">
        <div className="p-2.5 rounded-xl bg-danger-500/15 border border-danger-500/30 text-danger-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      </div>
    );

  // ---------------- STUDENT CHAT UI ----------------
  if (!isTeacher) {
    const privateRoom: ChatRoom = {
      roomType: 'private',
      roomKey: `s:${clientId}`,
      studentId: clientId,
    };
    const groupRoom: ChatRoom | null = groupId
      ? { roomType: 'group', roomKey: `g:${groupId}`, teamId: groupId }
      : null;
    const currentKey = selectedKey || privateRoom.roomKey;
    const activeRoom: ChatRoom =
      groupRoom && currentKey === groupRoom.roomKey ? groupRoom : privateRoom;
    const onGroupTab = activeRoom.roomType === 'group';
    const ownMessages = messages[activeRoom.roomKey] || [];
    const groupTeam = groupRoom ? teams[groupRoom.teamId] : null;
    const groupMemberCount = groupRoom
      ? (teams[groupRoom.teamId]?.memberIds || []).filter((id) => Boolean(students[id])).length
      : 0;
    const privateUnread = unread[privateRoom.roomKey] || 0;
    const groupUnread = groupRoom ? unread[groupRoom.roomKey] || 0 : 0;

    const title = onGroupTab ? t('chat_group_subtitle') : t('chat_student_title');
    const subtitle = onGroupTab
      ? t('chat_student_group_sub')
      : t('chat_student_private_sub');
    const emptyText = onGroupTab
      ? t('chat_group_empty_text')
      : t('chat_private_empty_text');

    return (
      <div className="flex flex-col h-full bg-surface/95 backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line bg-surface-sunken">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-[var(--shadow-pop-brand)] shrink-0 ${
                onGroupTab
                  ? 'bg-play-600'
                  : 'bg-brand-600'
              }`}
            >
              {onGroupTab ? (
                <Users className="w-5 h-5 text-ink" />
              ) : (
                <MessageSquare className="w-5 h-5 text-ink" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-ink text-sm uppercase tracking-wider truncate">
                {title}
                {onGroupTab && groupTeam ? ` — ${groupTeam.name}` : ''}
              </h3>
              <p className="text-xs text-ink-faint flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-play-400 animate-pulse" />
                {subtitle}
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-surface-raised hover:bg-surface-raised text-ink-soft hover:text-ink transition-colors shrink-0 cursor-pointer"
              aria-label={t('chat_close_aria')}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Room tabs: private chat vs own group chat */}
        {groupRoom && (
          <div className="px-4 py-2 border-b border-line bg-surface-sunken flex gap-2">
            <button
              onClick={() => openRoom(privateRoom.roomKey)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-colors cursor-pointer ${
                !onGroupTab
                  ? 'bg-brand-600 text-ink'
                  : 'bg-surface-raised text-ink-faint hover:text-ink'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {t('chat_teacher_tab')}
              {privateUnread > 0 && (
                <span className="min-w-4 h-4 px-1 rounded-full bg-danger-500 text-ink text-xs font-black flex items-center justify-center">
                  {privateUnread > 99 ? '99+' : privateUnread}
                </span>
              )}
            </button>
            <button
              onClick={() => openRoom(groupRoom.roomKey)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-colors cursor-pointer ${
                onGroupTab
                  ? 'bg-play-600 text-ink'
                  : 'bg-surface-raised text-ink-faint hover:text-ink'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              {t('chat_group_subtitle')}{groupMemberCount > 0 ? ` (${groupMemberCount})` : ''}
              {groupUnread > 0 && (
                <span className="min-w-4 h-4 px-1 rounded-full bg-danger-500 text-ink text-xs font-black flex items-center justify-center">
                  {groupUnread > 99 ? '99+' : groupUnread}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {loadingHistory && ownMessages.length === 0 && (
            <div className="flex items-center justify-center py-8 text-ink-faint text-xs">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> {t('chat_loading')}
            </div>
          )}

          {ownMessages.length === 0 && !loadingHistory && (
            <div className="text-center py-10 space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-300 text-brand-400 flex items-center justify-center mx-auto">
                {onGroupTab ? <Users className="w-7 h-7" /> : <MessageSquare className="w-7 h-7" />}
              </div>
              <p className="text-sm font-bold text-ink-soft uppercase tracking-wider">
                {t('chat_no_messages')}
              </p>
              <p className="text-xs text-ink-faint max-w-xs mx-auto">{emptyText}</p>
            </div>
          )}

          {ownMessages.map((msg) => {
            const mine = msg.senderId === clientId;
            return (
              <MessageBubble
                key={msg.id}
                msg={msg}
                mine={mine}
                showSender={!mine}
              />
            );
          })}
        </div>

        {renderError()}

        {renderInput(onGroupTab ? t('chat_group_placeholder') : t('chat_student_input'))}
      </div>
    );
  }

  // ---------------- TEACHER CHAT UI ----------------
  // `selectedRoom` is null until the teacher opens a room; every lookup below
  // falls back to '' so an object index is never `undefined` (TS2538) and no
  // room's message list is accidentally read before one is selected.
  const selectedRoomKey = selectedRoom?.roomKey ?? '';
  const currentStudent = selectedRoom?.roomType === 'private' ? students[selectedRoom.studentId] : null;
  const currentTeam = currentStudent?.teamId ? teams[currentStudent.teamId] : null;
  const selectedTeam = selectedRoom?.roomType === 'group' ? teams[selectedRoom.teamId] : null;
  const selectedTeamMemberCount = selectedTeam
    ? (selectedTeam.memberIds || []).filter((id) => Boolean(students[id])).length
    : 0;

  return (
    <div className="flex flex-col h-full bg-surface/95 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line bg-surface-sunken">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-warn-500/20 border border-warn-500/40 flex items-center justify-center shrink-0">
            <MessageSquare className="w-5 h-5 text-warn-400" />
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-ink text-sm uppercase tracking-wider truncate">
              {t('chat_teacher_chats')}
            </h3>
            <p className="text-xs text-ink-faint">
              {t('chat_teacher_sub')}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-surface-raised hover:bg-surface-raised text-ink-soft hover:text-ink transition-colors shrink-0 cursor-pointer"
            aria-label={t('chat_close_aria')}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {studentList.length === 0 && groupRooms.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-2">
            <Users className="w-10 h-10 text-ink-soft mx-auto" />
            <p className="text-sm font-bold text-ink-faint uppercase tracking-wider">
              {t('chat_no_students')}
            </p>
            <p className="text-xs text-ink-soft">
              {t('chat_no_students_sub')}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0">
          {/* Room list */}
          <div className="w-52 sm:w-64 border-r border-line overflow-y-auto bg-surface-sunken flex-shrink-0">
            {/* Group rooms */}
            {groupRooms.length > 0 && (
              <div className="py-2 border-b border-line">
                <div className="px-4 py-1.5 flex items-center gap-2">
                  <Users className="w-3 h-3 text-play-400" />
                  <span className="text-xs font-black uppercase tracking-widest text-play-400/90 truncate">
                    {t('chat_group_section')}
                  </span>                  <span className="text-xs text-ink-soft">
                    ({groupRooms.length})
                  </span>
                </div>

                {groupRooms.map((gr) => {
                  const team = teams[gr.teamId];
                  const active = selectedKey === gr.roomKey;
                  const unreadCount = unread[gr.roomKey] || 0;
                  const memberCount = (team.memberIds || []).filter((id) =>
                    Boolean(students[id])
                  ).length;
                  const preview = lastMessagePreview(messages[gr.roomKey], t);
                  return (
                    <button
                      key={gr.roomKey}
                      onClick={() => openRoom(gr.roomKey)}
                      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors cursor-pointer border-l-2 ${
                        active
                          ? 'bg-play-500/15 border-play-400 text-ink'
                          : 'border-transparent text-ink-soft hover:bg-surface-raised'
                      }`}
                    >
                      <span
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border"
                        style={{ backgroundColor: (team.color || '#10b981') + '22', borderColor: (team.color || '#10b981') + '55' }}
                      >
                        <Users className="w-4 h-4" style={{ color: team.color || '#10b981' }} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold truncate">
                          {team.name}
                          <span className="ml-1 text-xs text-ink-faint">
                            {memberCount} {t('chat_member')}
                          </span>
                        </span>
                        <span className="block text-xs text-ink-faint truncate">
                          {preview || t('chat_group_preview')}
                        </span>
                      </span>
                      {unreadCount > 0 && (
                        <span className="w-5 h-5 rounded-full bg-danger-500 text-ink text-xs font-black flex items-center justify-center shrink-0">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Private student rooms, grouped */}
            {groups.map((group) => (
              <div key={group.key} className="py-2">
                <div className="px-4 py-1.5 flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: group.color }}
                  />
                  <span className="text-xs font-black uppercase tracking-widest text-ink-faint truncate">
                    {group.label}
                  </span>
                  <span className="text-xs text-ink-soft">
                    ({group.students.length})
                  </span>
                </div>

                {group.students.map((st) => {
                  const roomKey = `s:${st.id}`;
                  const active = selectedKey === roomKey;
                  const unreadCount = unread[roomKey] || 0;
                  const preview = lastMessagePreview(messages[roomKey], t);
                  return (
                    <button
                      key={st.id}
                      onClick={() => openRoom(roomKey)}
                      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors cursor-pointer border-l-2 ${
                        active
                          ? 'bg-brand-500/15 border-brand-400 text-ink'
                          : 'border-transparent text-ink-soft hover:bg-surface-raised'
                      }`}
                    >
                      <span
                        className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 border ${
                          active
                            ? 'bg-brand-600 text-ink border-brand-400/60'
                            : 'bg-surface-raised text-brand-300 border-line'
                        }`}
                      >
                        {st.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold truncate">{st.name}</span>
                        <span className="flex items-center gap-1 text-xs text-ink-faint truncate">
                          {st.isLeader && <Crown className="w-2.5 h-2.5 text-warn-400" />}
                          {preview || (st.isLeader ? t('chat_captain_role') : t('chat_student_role'))}
                        </span>
                      </span>
                      {unreadCount > 0 && (
                        <span className="w-5 h-5 rounded-full bg-danger-500 text-ink text-xs font-black flex items-center justify-center shrink-0">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Chat area */}
          <div className="flex-1 min-w-0 flex flex-col">
            {selectedRoom?.roomType === 'group' && selectedTeam ? (
              <>
                {/* Group chat header */}
                <div className="px-4 py-3 border-b border-line bg-surface-sunken flex items-center gap-3">
                  <span
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
                    style={{
                      backgroundColor: (selectedTeam.color || '#10b981') + '22',
                      borderColor: (selectedTeam.color || '#10b981') + '66',
                    }}
                  >
                    <Users className="w-5 h-5" style={{ color: selectedTeam.color || '#10b981' }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="block font-bold text-ink text-sm truncate">
                      {selectedTeam.name}
                    </span>
                    <p className="text-xs text-ink-faint truncate">
                      {selectedTeamMemberCount} {t('chat_member')} · {t('chat_student_group_sub')}
                    </p>
                  </div>
                </div>

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                  {(messages[selectedRoomKey] || []).length === 0 && (
                    <div className="text-center py-10 space-y-1">
                      <Users className="w-8 h-8 text-play-400/60 mx-auto" />
                      <p className="text-xs font-bold text-ink-faint uppercase tracking-wider">
                        {t('chat_group_empty')}
                      </p>
                      <p className="text-xs text-ink-soft">
                        {t('chat_group_empty_sub')}
                      </p>
                    </div>
                  )}

                  {(messages[selectedRoomKey] || []).map((msg) => {
                    const mine = msg.senderId === clientId;
                    return (
                      <MessageBubble key={msg.id} msg={msg} mine={mine} showSender={!mine} />
                    );
                  })}
                </div>

                {renderError()}
                {renderInput(t('chat_group_placeholder'))}
              </>
            ) : currentStudent ? (
              <>
                {/* Private chat header */}
                <div className="px-4 py-3 border-b border-line bg-surface-sunken flex items-center gap-3">
                  <span
                    className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 border"
                    style={{
                      backgroundColor: currentTeam?.color || '#6366f1',
                      borderColor: (currentTeam?.color || '#6366f1') + '66',
                    }}
                  >
                    {currentStudent.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-ink text-sm truncate">
                        {currentStudent.name}
                      </span>
                      {currentStudent.isLeader && (
                        <Crown className="w-3.5 h-3.5 text-warn-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-ink-faint truncate">
                      {currentTeam ? currentTeam.name : t('chat_no_group')}
                    </p>
                  </div>
                </div>

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                  {(messages[selectedRoomKey] || []).length === 0 && (
                    <div className="text-center py-10 space-y-1">
                      <CheckCircle2 className="w-8 h-8 text-play-400/60 mx-auto" />
                      <p className="text-xs font-bold text-ink-faint uppercase tracking-wider">
                        {t('chat_start')}
                      </p>
                      <p className="text-xs text-ink-soft">
                        {t('chat_private_hint')}
                      </p>
                    </div>
                  )}

                  {(messages[selectedRoomKey] || []).map((msg) => {
                    const mine = msg.senderId === clientId;
                    // In a private chat only show the teacher's label.
                    return (
                      <MessageBubble
                        key={msg.id}
                        msg={msg}
                        mine={mine}
                        showSender={!mine && msg.role === 'teacher'}
                      />
                    );
                  })}
                </div>

                {renderError()}
                {renderInput(t('chat_teacher_placeholder_name').replace('{name}', currentStudent.name))}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8">
                <p className="text-xs text-ink-faint text-center">
                  {t('chat_no_room')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface StudentChatLauncherProps {
  clientId: string;
  pin: string;
  students?: Record<string, Student>;
  teams?: Record<string, Team>;
  groupId?: string | null;
}

export const StudentChatLauncher: React.FC<StudentChatLauncherProps> = ({
  clientId,
  pin,
  students = {},
  teams = {},
  groupId = null,
}) => {
  const { t } = useLang();
  const [open, setOpen] = useState(false);

  return (
    <>
      {!open && (
        <button
          data-testid="chat-launcher"
          onClick={() => setOpen(true)}
          className="relative mt-6 mx-auto block lg:fixed lg:bottom-6 lg:right-6 lg:mx-0 lg:mt-0 z-50 w-14 h-14 rounded-2xl bg-brand-600 hover:bg-brand-500 text-ink shadow-[var(--shadow-pop-brand)] flex items-center justify-center transition-all cursor-pointer border border-brand-400/40 group"
          title={t('chat_launcher_title')}
          aria-label={t('chat_launcher_open')}
        >
          <MessageSquare className="w-6 h-6 group-hover:scale-110 transition-transform" />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-play-400 border-2 border-surface-sunken" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-4 right-3 sm:bottom-6 sm:right-6 z-[60] w-[calc(100vw-1.5rem)] max-w-[400px] h-[min(560px,70vh)] flex flex-col overflow-hidden rounded-2xl border border-line shadow-2xl shadow-surface-sunken/60 animate-[var(--animate-fade-in)]">
          <ChatSection
            clientId={clientId}
            pin={pin}
            isTeacher={false}
            students={students}
            teams={teams}
            groupId={groupId}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </>
  );
};

interface TeacherChatLauncherProps {
  clientId: string;
  pin: string;
  students: Record<string, Student>;
  teams: Record<string, Team>;
}

export const TeacherChatLauncher: React.FC<TeacherChatLauncherProps> = ({
  clientId,
  pin,
  students,
  teams,
}) => {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const studentCount = Object.keys(students || {}).length;

  return (
    <>
      <button
        data-testid="chat-launcher"
        onClick={() => setOpen(true)}
        className="relative mt-6 mx-auto block lg:fixed lg:bottom-6 lg:right-6 lg:mx-0 lg:mt-0 z-50 w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-play-600 text-ink shadow-[0_0_25px_rgba(99,102,241,0.55)] hover:shadow-[var(--shadow-pop-play)] hover:scale-105 active:scale-95 transition-all border border-line flex items-center justify-center group cursor-pointer"
        title={t('chat_launcher_students')}
        aria-label={t('chat_launcher_open')}
      >
        <MessagesSquare className="w-7 h-7 group-hover:scale-110 transition-transform" strokeWidth={2.2} />
        <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1.5 rounded-full bg-warn-400 text-surface-sunken text-xs font-black flex items-center justify-center border-2 border-surface-sunken shadow-[0_0_10px_rgba(251,191,36,0.6)]">
          {studentCount}
        </span>
      </button>

      {open && (
        <div className="fixed bottom-24 right-3 sm:right-6 z-[60] w-[calc(100vw-1.5rem)] max-w-[720px] h-[min(600px,75vh)] flex flex-col overflow-hidden rounded-2xl border border-line shadow-2xl shadow-surface-sunken/60 animate-[var(--animate-fade-in)]">
          <ChatSection
            clientId={clientId}
            pin={pin}
            isTeacher={true}
            students={students}
            teams={teams}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </>
  );
};
