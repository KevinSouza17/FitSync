import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Send, Search, ArrowLeft, MessageCircle, UserCircle, UserPlus, ImagePlus, Mic, Loader2, X, Trash2, Square, Paperclip, File as FileIcon, Download } from "lucide-react";
import { AudioPlayer } from "../components/AudioPlayer";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationsContext";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import { InviteModal } from "../components/InviteModal";
import { useI18n } from "../context/I18nContext";

interface ConversationRow {
  id: string;
  user_a_id: string;
  user_b_id: string;
  last_message_at: string;
  otherName: string;
  otherRole: string;
  otherId: string;
  otherAvatar: string | null;
  lastContent: string;
  unread: number;
}

interface MessageRow {
  id: string;
  sender_id: string;
  content: string;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" });
}

export function Messages() {
  const { user } = useAuth();
  const { notifications, markRead } = useNotifications();
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeName, setActiveName] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [sendingAudio, setSendingAudio] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [otherTyping, setOtherTyping] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileUploading, setFileUploading] = useState(false);
  const fileDocInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const activeConv = conversations.find((c) => c.id === activeId);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    const { data: convs } = await supabase
      .from("conversations")
      .select("*")
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      .order("last_message_at", { ascending: false });
    if (!convs) { setLoading(false); return; }

    const enriched: ConversationRow[] = await Promise.all(
      convs.map(async (c) => {
        const otherId = c.user_a_id === user.id ? c.user_b_id : c.user_a_id;
        const { data: other } = await supabase
          .from("profiles")
          .select("full_name, professional_role, is_professional, avatar_url")
          .eq("id", otherId)
          .maybeSingle();
        const { data: lastMsg } = await supabase
          .from("messages")
          .select("content, media_type, read, sender_id")
          .eq("conversation_id", c.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", c.id)
          .eq("read", false)
          .neq("sender_id", user.id);
        return {
          id: c.id, user_a_id: c.user_a_id, user_b_id: c.user_b_id,
          last_message_at: c.last_message_at, otherId,
          otherName: other?.full_name || "Usuário",
          otherRole: other?.is_professional ? other.professional_role ?? t("messages.professional") : t("messages.patient"),
          otherAvatar: other?.avatar_url ?? null,
          lastContent: lastMsg?.content ?? (lastMsg?.media_type ? `[${lastMsg.media_type}]` : ""),
          unread: count ?? 0,
        };
      })
    );
    setConversations(enriched);
    setLoading(false);
  }, [user, t]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("messages-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => loadConversations())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => loadConversations())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadConversations]);

  useEffect(() => {
    const targetId = searchParams.get("c");
    if (targetId && conversations.length > 0 && !activeId) {
      const c = conversations.find((cv) => cv.id === targetId);
      if (c) { setActiveId(c.id); setActiveName(c.otherName); }
    }
  }, [searchParams, conversations, activeId]);

  useEffect(() => {
    if (!activeId) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, sender_id, content, media_url, media_type, created_at")
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true });
      setMessages(data ?? []);
      if (user) {
        await supabase.from("messages").update({ read: true })
          .eq("conversation_id", activeId).neq("sender_id", user.id).eq("read", false);
        loadConversations();
      }
      channel = supabase
        .channel(`conv-${activeId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
          (payload) => {
            const row = payload.new as MessageRow;
            setMessages((prev) => prev.some((m) => m.id === row.id) ? prev : [...prev, row]);
            setOtherTyping(false);
            if (user && row.sender_id !== user.id) {
              supabase.from("messages").update({ read: true }).eq("id", row.id).eq("read", false)
                .then(() => loadConversations());
            }
          })
        .subscribe();

      typingChannelRef.current = supabase
        .channel(`typing-${activeId}`)
        .on("broadcast", { event: "typing" }, (payload) => {
          if (payload.payload?.userId && payload.payload.userId !== user?.id) {
            setOtherTyping(true);
            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
            typingTimerRef.current = setTimeout(() => setOtherTyping(false), 3000);
          }
        })
        .on("broadcast", { event: "stop-typing" }, (payload) => {
          if (payload.payload?.userId && payload.payload.userId !== user?.id) {
            setOtherTyping(false);
          }
        })
        .subscribe();
    })();
    return () => {
      if (channel) supabase.removeChannel(channel);
      if (typingChannelRef.current) {
        supabase.removeChannel(typingChannelRef.current);
        typingChannelRef.current = null;
      }
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      setOtherTyping(false);
    };
  }, [activeId, user, loadConversations]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // ── Send text message ──
  function sendTypingEvent(isTyping: boolean) {
    if (!typingChannelRef.current || !user) return;
    typingChannelRef.current.send({
      type: "broadcast",
      event: isTyping ? "typing" : "stop-typing",
      payload: { userId: user.id },
    });
  }

  function handleDraftChange(value: string) {
    setDraft(value);
    if (value.trim()) {
      sendTypingEvent(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => sendTypingEvent(false), 2000);
    } else {
      sendTypingEvent(false);
    }
  }

  async function handleSend() {
    if (!draft.trim() || !activeId || !user) return;
    const text = draft.trim();
    setDraft("");
    sendTypingEvent(false);
    const { data } = await supabase
      .from("messages")
      .insert({ conversation_id: activeId, sender_id: user.id, content: text })
      .select("id, sender_id, content, media_url, media_type, created_at")
      .single();
    if (data) {
      setMessages((prev) => [...prev, data]);
      loadConversations();
      fireMessageEmail(activeId, text).catch(() => {});
    }
  }

  // ── Send photo ──
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user || !activeId) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const fileName = `${user.id}/msg-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(fileName, file);
    if (upErr) { setUploading(false); return; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
    const mediaUrl = `${data.publicUrl}?t=${Date.now()}`;
    const { data: msg } = await supabase
      .from("messages")
      .insert({ conversation_id: activeId, sender_id: user.id, content: "", media_url: mediaUrl, media_type: "image" })
      .select("id, sender_id, content, media_url, media_type, created_at")
      .single();
    if (msg) {
      setMessages((prev) => [...prev, msg]);
      loadConversations();
    }
    setUploading(false);
  }

  // ── Send file attachment ──
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user || !activeId) return;
    if (file.size > 50 * 1024 * 1024) return;
    setFileUploading(true);
    const ext = file.name.split(".").pop() || "bin";
    const fileName = `${user.id}/file-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(fileName, file);
    if (upErr) { setFileUploading(false); return; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
    const mediaUrl = `${data.publicUrl}?t=${Date.now()}`;
    const isVideo = file.type.startsWith("video/");
    const mediaType = isVideo ? "video" : "file";
    const { data: msg } = await supabase
      .from("messages")
      .insert({ conversation_id: activeId, sender_id: user.id, content: file.name, media_url: mediaUrl, media_type: mediaType })
      .select("id, sender_id, content, media_url, media_type, created_at")
      .single();
    if (msg) {
      setMessages((prev) => [...prev, msg]);
      loadConversations();
    }
    setFileUploading(false);
  }

  // ── Audio recording ──
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordTime(0);
      recordTimerRef.current = setInterval(() => {
        setRecordTime((prev) => prev + 1);
      }, 1000);
    } catch {
      setRecording(false);
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  }

  function cancelRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecordTime(0);
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  }

  async function sendAudio() {
    if (!recordedBlob || !user || !activeId) return;
    setSendingAudio(true);
    const fileName = `${user.id}/audio-${Date.now()}.webm`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(fileName, recordedBlob);
    if (upErr) { setSendingAudio(false); return; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
    const mediaUrl = `${data.publicUrl}?t=${Date.now()}`;
    const { data: msg } = await supabase
      .from("messages")
      .insert({ conversation_id: activeId, sender_id: user.id, content: "", media_url: mediaUrl, media_type: "audio" })
      .select("id, sender_id, content, media_url, media_type, created_at")
      .single();
    if (msg) {
      setMessages((prev) => [...prev, msg]);
      loadConversations();
    }
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecordTime(0);
    setSendingAudio(false);
  }

  async function fireMessageEmail(convId: string, content: string) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-message`;
    await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ conversationId: convId, content }),
    });
  }

  async function deleteMessage(msgId: string) {
    if (!user) return;
    await supabase.from("messages").delete().eq("id", msgId).eq("sender_id", user.id);
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    loadConversations();
  }

  function openConversation(c: ConversationRow) {
    setActiveId(c.id);
    setActiveName(c.otherName);
    setSearchParams({ c: c.id });
    notifications
      .filter((n) => n.type === "message" && n.conversation_id === c.id && !n.read)
      .forEach((n) => markRead(n.id));
  }

  const filtered = conversations.filter((c) =>
    !search.trim() || c.otherName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-screen-ios overflow-hidden">
      <aside className={`flex w-full flex-col border-r border-slate-200 bg-white md:w-80 xl:w-96 ${activeId ? "hidden md:flex" : "flex"}`}>
        <div className="border-b border-slate-100 px-5 pt-safe pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-slate-900">{t("messages.title")}</h1>
              <p className="mt-0.5 text-xs text-slate-500">{t("messages.subtitle")}</p>
            </div>
            <button onClick={() => setInviteOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white transition-colors hover:bg-primary-700" title={t("messages.invitePerson")}>
              <UserPlus className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="flex h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100" placeholder={t("messages.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {loading ? (
            <div className="flex h-40 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <MessageCircle className="mb-2 h-10 w-10 text-slate-200" />
              <p className="text-sm font-medium text-slate-600">{t("messages.noConversations")}</p>
              <p className="mt-0.5 text-xs text-slate-400">{t("messages.inviteSomeone")}</p>
            </div>
          ) : (
            filtered.map((c) => (
              <button key={c.id} onClick={() => openConversation(c)} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${activeId === c.id ? "bg-primary-50" : "hover:bg-slate-50"}`}>
                <Avatar className="h-11 w-11 shrink-0">
                  {c.otherAvatar ? <AvatarImage src={c.otherAvatar} alt={c.otherName} /> : <AvatarFallback className="bg-primary-100 text-sm font-bold text-primary-700">{initials(c.otherName)}</AvatarFallback>}
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-sm font-semibold text-slate-900">{c.otherName}</p>
                    <span className="shrink-0 text-[10px] text-slate-400">{formatTime(c.last_message_at)}</span>
                  </div>
                  <p className="truncate text-xs text-slate-500">{c.lastContent || c.otherRole}</p>
                </div>
                {c.unread > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1.5 text-[10px] font-bold text-white">{c.unread}</span>}
              </button>
            ))
          )}
        </div>
      </aside>

      {activeId && activeConv ? (
        <section className="flex flex-1 flex-col bg-slate-50">
          <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-5 pt-safe pb-3.5">
            <button onClick={() => { setActiveId(null); setActiveName(""); setSearchParams({}); }} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden"><ArrowLeft className="h-5 w-5" /></button>
            <Avatar className="h-10 w-10"><AvatarFallback className="bg-primary-100 text-sm font-bold text-primary-700">{initials(activeName)}</AvatarFallback></Avatar>
            <div className="flex-1"><p className="text-sm font-semibold text-slate-900">{activeName}</p><p className="text-xs text-primary-600">{activeConv.otherRole}</p></div>
            <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><UserCircle className="h-5 w-5" /></button>
          </header>

          <div ref={scrollRef} className="ios-scroll flex-1 overflow-y-auto px-4 py-6">
            <div className="mx-auto flex max-w-2xl flex-col gap-3">
              {messages.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center py-20 text-center">
                  <MessageCircle className="mb-2 h-10 w-10 text-slate-200" />
                  <p className="text-sm text-slate-400">{t("messages.noMessagesYet")}</p>
                </div>
              ) : (
                messages.map((m) => {
                  const isMine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={`group flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className={`relative max-w-[75%] break-words text-sm leading-relaxed ${isMine ? "bg-primary-600 text-white" : "bg-white text-slate-700"} ${m.content && (m.media_type === "image" || m.media_type === "video" || m.media_type === "file") ? "rounded-2xl" : "rounded-2xl px-4 py-2.5 shadow-sm"} ${isMine && m.content && (m.media_type === "image" || m.media_type === "video" || m.media_type === "file") ? "rounded-br-md" : isMine ? "rounded-br-md" : "rounded-bl-md"} ${!m.content && (m.media_type === "image" || m.media_type === "video") ? "overflow-hidden" : ""}`}>
                        {m.media_type === "image" && m.media_url && (
                          <img src={m.media_url} alt="" className="block max-h-60 w-full cursor-zoom-in rounded-2xl object-cover" onClick={() => setLightboxUrl(m.media_url)} />
                        )}
                        {m.media_type === "video" && m.media_url && (
                          <video src={m.media_url} controls playsInline className="block max-h-60 w-full rounded-2xl" />
                        )}
                        {m.media_type === "file" && m.media_url && (
                          <a href={m.media_url} download={m.content || undefined} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${isMine ? "hover:bg-primary-700" : "hover:bg-slate-50"}`}>
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isMine ? "bg-white/20" : "bg-slate-100"}`}>
                              <FileIcon className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-sm font-medium">{m.content || "Arquivo"}</p>
                              <p className={`text-xs ${isMine ? "text-primary-100" : "text-slate-400"}`}>Toque para baixar</p>
                            </div>
                            <Download className="h-4 w-4 shrink-0" />
                          </a>
                        )}
                        {m.media_type === "audio" && m.media_url && (
                          <div className="min-w-[200px]">
                            <AudioPlayer url={m.media_url} isMine={isMine} label={t("messages.audio")} />
                          </div>
                        )}
                        {m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>}
                        <div className="flex items-center justify-end gap-2">
                          <p className={`mt-1 text-[10px] ${isMine ? "text-primary-100" : "text-slate-400"}`}>{formatTime(m.created_at)}</p>
                          {isMine && (
                            <button onClick={() => deleteMessage(m.id)} className="opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {otherTyping && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm">
                    <span className="typing-dot h-2 w-2 rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                    <span className="typing-dot h-2 w-2 rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                    <span className="typing-dot h-2 w-2 rounded-full bg-slate-400" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Audio preview bar */}
          {recordedUrl && (
            <div className="flex items-center gap-3 border-t border-slate-200 bg-amber-50 px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-medium text-amber-700">{Math.floor(recordTime / 60)}:{(recordTime % 60).toString().padStart(2, "0")}</span>
              </div>
              <audio src={recordedUrl} controls className="h-8 flex-1" />
              <button onClick={sendAudio} disabled={sendingAudio} className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-white disabled:opacity-40">
                {sendingAudio ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
              <button onClick={cancelRecording} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Recording indicator bar */}
          {recording && !recordedUrl && (
            <div className="flex items-center gap-3 border-t border-red-200 bg-red-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                </span>
                <span className="text-sm font-semibold text-red-600">Gravando áudio...</span>
              </div>
              <div className="flex flex-1 items-center justify-center gap-1">
                {[0,1,2,3,4,5,6,7,8,9,10,11].map((i) => (
                  <span
                    key={i}
                    className="w-1 rounded-full bg-red-400 wave-bar"
                    style={{ animationDelay: `${i * 0.08}s`, height: "6px" }}
                  />
                ))}
              </div>
              <span className="text-sm font-mono text-red-600">{Math.floor(recordTime / 60)}:{(recordTime % 60).toString().padStart(2, "0")}</span>
              <button onClick={stopRecording} className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600">
                <Square className="h-4 w-4" />
              </button>
              <button onClick={cancelRecording} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Composer */}
          <div className="border-t border-slate-200 bg-white px-4 pt-3 pb-safe">
            <div className="mx-auto flex max-w-2xl items-center gap-2">
              <input ref={(el) => { fileInputRef.current = el; }} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              <input ref={(el) => { fileDocInputRef.current = el; }} type="file" onChange={handleFileUpload} className="hidden" />
              <button onClick={() => fileDocInputRef.current?.click()} disabled={fileUploading || uploading || !!recordedUrl} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-40" title="Enviar arquivo">
                {fileUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-5 w-5" />}
              </button>
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading || !!recordedUrl} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-40">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
              </button>
              <button
                onClick={recording ? stopRecording : startRecording}
                disabled={!!recordedUrl}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all disabled:opacity-40 ${recording ? "bg-red-500 text-white record-pulse" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                <Mic className="h-5 w-5" />
              </button>
              <input
                className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
                placeholder={recording ? t("messages.recording") : t("messages.typeMessage")}
                value={draft}
                onChange={(e) => handleDraftChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                disabled={recording || !!recordedUrl}
              />
              <button onClick={handleSend} disabled={!draft.trim() || recording || !!recordedUrl} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="hidden flex-1 flex-col items-center justify-center bg-slate-50 md:flex">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-50"><MessageCircle className="h-8 w-8 text-primary-600" /></div>
            <h2 className="text-lg font-semibold text-slate-700">{t("messages.yourMessages")}</h2>
            <p className="mt-1 max-w-xs text-sm text-slate-400">{t("messages.selectConversation")}</p>
            <button onClick={() => setInviteOpen(true)} className="mt-5 flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700">
              <UserPlus className="h-4 w-4" />{t("messages.invitePerson")}
            </button>
          </div>
        </section>
      )}
      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightboxUrl}
            alt=""
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
