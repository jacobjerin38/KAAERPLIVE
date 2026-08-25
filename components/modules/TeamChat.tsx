import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
    MessageSquare, Send, Paperclip, Users, Hash, Plus, Search,
    Download, FileText, Image as ImageIcon, X, Volume2, VolumeX,
    UserCircle, Circle
} from 'lucide-react';
import {
    getChatRooms, getOrCreateDirectChatRoom, createGroupChatRoom,
    getChatMessages, sendChatMessage, ChatRoom, ChatMessage,
    getDepartmentChatRoom
} from '../crm/enhancementServices';

// Sound Helper (Web Audio API synthesised chime to avoid loading external files)
const playNotificationSound = () => {
    try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5

        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);

        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
        console.error("Audio playback failed", e);
    }
};

// Attachment preview component to fetch and render presigned URLs dynamically
const AttachmentPreview: React.FC<{ attachment: any }> = ({ attachment }) => {
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        const fetchUrl = async () => {
            try {
                const { data, error } = await supabase.storage
                    .from('attachments')
                    .createSignedUrl(attachment.path, 3600);
                if (error) throw error;
                if (active && data) setUrl(data.signedUrl);
            } catch (err) {
                console.error("Error creating signed URL:", err);
            } finally {
                if (active) setLoading(false);
            }
        };

        fetchUrl();
        return () => {
            active = false;
        };
    }, [attachment.path]);

    if (loading) {
        return <div className="text-xs text-slate-400 animate-pulse mt-2 py-1">Loading attachment...</div>;
    }

    if (!url) {
        return <div className="text-xs text-rose-500 mt-2">Failed to load file</div>;
    }

    const isImage = attachment.type?.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(attachment.name);

    if (isImage) {
        return (
            <div className="mt-2 rounded-xl overflow-hidden max-w-xs border border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                <a href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt={attachment.name} className="max-h-48 object-cover w-full hover:opacity-90 transition-opacity" />
                </a>
                <div className="bg-slate-50 dark:bg-zinc-800/50 px-3 py-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                    <span className="truncate max-w-[150px] font-medium">{attachment.name}</span>
                    <a href={url} download={attachment.name} className="text-indigo-500 hover:text-indigo-600 ml-2">
                        <Download className="w-4 h-4" />
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-2 flex items-center gap-3 p-3 bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800 rounded-xl max-w-xs">
            <FileText className="w-8 h-8 text-indigo-500 shrink-0" />
            <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{attachment.name}</p>
                <p className="text-[10px] text-slate-400 font-medium">{(attachment.size / 1024).toFixed(1)} KB</p>
            </div>
            <a href={url} download={attachment.name} className="p-2 hover:bg-slate-200/50 dark:hover:bg-zinc-700 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                <Download className="w-4 h-4" />
            </a>
        </div>
    );
};

export const TeamChat: React.FC = () => {
    const { user, currentCompanyId } = useAuth();
    const [rooms, setRooms] = useState<ChatRoom[]>([]);
    const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
    const [soundEnabled, setSoundEnabled] = useState(true);

    // List of all employees/profiles to start a chat with
    const [profiles, setProfiles] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [showGroupModal, setShowGroupModal] = useState(false);
    
    // Group Creation fields
    const [groupName, setGroupName] = useState('');
    const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);

    // Search filter for room list & contact list
    const [searchTerm, setSearchTerm] = useState('');
    const [modalSearchTerm, setModalSearchTerm] = useState('');

    // File Upload State
    const [uploading, setUploading] = useState(false);
    const [pendingAttachments, setPendingAttachments] = useState<any[]>([]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 1. Fetch Rooms, Profiles and Departments
    const loadInitialData = async () => {
        if (!currentCompanyId || !user) return;

        // 1. Fetch user profiles in the company
        const { data: profs } = await (supabase as any)
            .from('profiles')
            .select('id, full_name, email, avatar_url, role')
            .eq('company_id', currentCompanyId)
            .neq('id', user.id); // Exclude self

        // 2. Fetch all active employees (even if not linked to a user profile yet)
        const { data: emps } = await (supabase as any)
            .from('employees')
            .select('id, profile_id, name, office_email, personal_email, email')
            .eq('company_id', currentCompanyId)
            .eq('status', 'Active')
            .neq('profile_id', user.id);

        const mergedMap = new Map<string, any>();

        if (profs) {
            profs.forEach((p: any) => {
                mergedMap.set(p.id, {
                    id: p.id,
                    employee_id: null,
                    full_name: p.full_name || p.email?.split('@')[0] || 'Employee',
                    email: p.email,
                    avatar_url: p.avatar_url,
                    role: p.role || 'Employee',
                    hasAccount: true
                });
            });
        }

        if (emps) {
            emps.forEach((e: any) => {
                const empEmail = (e.office_email || e.personal_email || e.email || '').toLowerCase();
                
                // Check if we can match this employee to a profile client-side or by profile_id
                let matchedProfile: any = null;
                if (e.profile_id) {
                    matchedProfile = mergedMap.get(e.profile_id);
                } else if (empEmail) {
                    matchedProfile = Array.from(mergedMap.values()).find(
                        (p: any) => p.email && p.email.toLowerCase() === empEmail
                    );
                }

                if (matchedProfile) {
                    mergedMap.set(matchedProfile.id, {
                        ...matchedProfile,
                        employee_id: e.id,
                        full_name: e.name || matchedProfile.full_name,
                        email: e.office_email || e.personal_email || e.email || matchedProfile.email,
                        hasAccount: true
                    });
                } else {
                    const tempId = `emp_${e.id}`;
                    mergedMap.set(tempId, {
                        id: tempId,
                        employee_id: e.id,
                        full_name: e.name || empEmail.split('@')[0] || 'Employee',
                        email: e.office_email || e.personal_email || e.email || '',
                        avatar_url: null,
                        role: 'Employee (Pending Account)',
                        hasAccount: false
                    });
                }
            });
        }

        setProfiles(Array.from(mergedMap.values()));

        // Fetch departments
        const { data: depts } = await (supabase as any)
            .from('departments')
            .select('id, name, code')
            .eq('company_id', currentCompanyId);
        
        if (depts) setDepartments(depts);

        // Fetch rooms
        const chatRooms = await getChatRooms(currentCompanyId, user.id);
        setRooms(chatRooms);
        if (chatRooms.length > 0) {
            setActiveRoom(chatRooms[0]);
        }
    };

    useEffect(() => {
        loadInitialData();
    }, [currentCompanyId, user?.id]);

    // 2. Fetch Messages when Active Room changes
    useEffect(() => {
        if (!activeRoom) return;

        const loadMessages = async () => {
            const msgs = await getChatMessages(activeRoom.id);
            setMessages(msgs);
            setTimeout(scrollToBottom, 50);
        };

        loadMessages();

        // Subscribe to messages in this room
        const roomChannel = supabase.channel(`room:${activeRoom.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_messages',
                    filter: `room_id=eq.${activeRoom.id}`
                },
                async (payload) => {
                    const raw = payload.new as any;
                    if (!raw) return;

                    let sender = profiles.find(p => p.id === raw.sender_id);
                    if (!sender && raw.sender_id === user?.id) {
                        sender = { id: user.id, full_name: 'You', avatar_url: (user as any).avatar_url };
                    }
                    if (!sender) {
                        const { data: prof } = await (supabase as any)
                            .from('profiles')
                            .select('id, full_name, avatar_url, email')
                            .eq('id', raw.sender_id)
                            .maybeSingle();
                        sender = prof;
                    }

                    const newMsg: ChatMessage = {
                        id: raw.id,
                        room_id: raw.room_id,
                        sender_id: raw.sender_id,
                        message: raw.message,
                        attachments: raw.attachments || [],
                        created_at: raw.created_at,
                        sender: sender || { id: raw.sender_id, full_name: 'Team Member' }
                    };

                    setMessages(prev => {
                        if (prev.some(m => m.id === newMsg.id)) return prev;
                        if (newMsg.sender_id !== user?.id && soundEnabled) {
                            playNotificationSound();
                        }
                        return [...prev, newMsg];
                    });
                    setTimeout(scrollToBottom, 50);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(roomChannel);
        };
    }, [activeRoom?.id, profiles]);

    // 3. Realtime Presence Subscription
    useEffect(() => {
        if (!currentCompanyId || !user) return;

        const presenceChannel = supabase.channel(`presence:${currentCompanyId}`);
        presenceChannel
            .on('presence', { event: 'sync' }, () => {
                const state = presenceChannel.presenceState();
                const onlineIds = Object.values(state)
                    .flatMap(presenceInfo => presenceInfo)
                    .map((p: any) => p.profile_id);
                setOnlineUsers(Array.from(new Set(onlineIds)));
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await presenceChannel.track({
                        profile_id: user.id,
                        online_at: new Date().toISOString()
                    });
                }
            });

        return () => {
            supabase.removeChannel(presenceChannel);
        };
    }, [currentCompanyId, user?.id]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // 4. File Attachment Upload Handler
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !currentCompanyId || !activeRoom) return;

        const file = files[0];
        if (file.size > 10 * 1024 * 1024) {
            alert("File size exceeds 10MB limit.");
            return;
        }

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `${currentCompanyId}/chat/${activeRoom.id}/${fileName}`;

            const { error } = await supabase.storage
                .from('attachments')
                .upload(filePath, file);

            if (error) throw error;

            const attachmentInfo = {
                path: filePath,
                name: file.name,
                size: file.size,
                type: file.type
            };

            setPendingAttachments(prev => [...prev, attachmentInfo]);
        } catch (err: any) {
            console.error("Error uploading file:", err);
            alert("Upload failed: " + err.message);
        } finally {
            setUploading(false);
        }
    };

    const removePendingAttachment = (index: number) => {
        setPendingAttachments(prev => prev.filter((_, i) => i !== index));
    };

    // 5. Send Message
    const handleSendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!activeRoom || !user || (!inputMessage.trim() && pendingAttachments.length === 0)) return;

        const msgText = inputMessage.trim();
        const msgAtts = pendingAttachments;

        setInputMessage('');
        setPendingAttachments([]);

        const sent = await sendChatMessage(activeRoom.id, user.id, msgText, msgAtts);
        if (!sent) {
            alert("Failed to send message. Please try again.");
            setInputMessage(msgText);
            setPendingAttachments(msgAtts);
        } else {
            setMessages(prev => {
                if (prev.some(m => m.id === sent.id)) return prev;
                return [...prev, sent];
            });
            setTimeout(scrollToBottom, 50);
        }
    };

    // 6. Direct Chat Creator
    const handleSelectContact = async (contactId: string) => {
        if (!currentCompanyId || !user) return;

        // Check if employee has a linked user account
        const contact = profiles.find(p => p.id === contactId);
        if (contact && contact.id.startsWith('emp_')) {
            alert(`"${contact.full_name}" does not have an active user account yet. Once they sign up or their user account is linked, you can start a chat with them.`);
            return;
        }

        setShowNewChatModal(false);

        const room = await getOrCreateDirectChatRoom(currentCompanyId, user.id, contactId);
        if (room) {
            setRooms(prev => {
                if (prev.some(r => r.id === room.id)) return prev;
                return [room, ...prev];
            });
            setActiveRoom(room);
        }
    };

    // 7. Department Chat Handler
    const handleSelectDepartment = async (deptId: number, deptName: string) => {
        if (!currentCompanyId || !user) return;
        setShowNewChatModal(false);

        const room = await getDepartmentChatRoom(currentCompanyId, deptId, `${deptName} Channel`);
        if (room) {
            // Join user if not already participant
            const { data: isPart } = await (supabase as any)
                .from('chat_participants')
                .select('*')
                .eq('room_id', room.id)
                .eq('profile_id', user.id)
                .maybeSingle();

            if (!isPart) {
                await (supabase as any).from('chat_participants').insert([
                    { room_id: room.id, profile_id: user.id }
                ]);
            }

            const updatedRooms = await getChatRooms(currentCompanyId, user.id);
            setRooms(updatedRooms);
            const foundRoom = updatedRooms.find(r => r.id === room.id);
            if (foundRoom) setActiveRoom(foundRoom);
        }
    };

    // 8. Group Chat Creator
    const handleCreateGroup = async () => {
        if (!currentCompanyId || !user || !groupName.trim() || selectedGroupMembers.length === 0) return;

        const members = [user.id, ...selectedGroupMembers];
        const room = await createGroupChatRoom(currentCompanyId, groupName.trim(), members);

        if (room) {
            setRooms(prev => [room, ...prev]);
            setActiveRoom(room);
            setGroupName('');
            setSelectedGroupMembers([]);
            setShowGroupModal(false);
        } else {
            alert("Failed to create group room.");
        }
    };

    const toggleGroupMember = (pid: string) => {
        setSelectedGroupMembers(prev =>
            prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]
        );
    };

    // 9. Format display names for rooms
    const getRoomDisplayName = (room: ChatRoom) => {
        if (room.type === 'direct') {
            const peer = room.participants?.find(p => p.profile_id !== user?.id);
            return peer?.profile?.full_name || peer?.profile?.email?.split('@')[0] || 'Direct Chat';
        }
        return room.name || 'Group Chat';
    };

    const getRoomAvatarUrl = (room: ChatRoom) => {
        if (room.type === 'direct') {
            const peer = room.participants?.find(p => p.profile_id !== user?.id);
            return peer?.profile?.avatar_url;
        }
        return null;
    };

    const isPeerOnline = (room: ChatRoom) => {
        if (room.type === 'direct') {
            const peer = room.participants?.find(p => p.profile_id !== user?.id);
            return peer ? onlineUsers.includes(peer.profile_id) : false;
        }
        return false;
    };

    // Filters
    const filteredRooms = rooms.filter(r =>
        getRoomDisplayName(r).toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredProfiles = profiles.filter(p =>
        (p.full_name || '').toLowerCase().includes(modalSearchTerm.toLowerCase()) ||
        (p.email || '').toLowerCase().includes(modalSearchTerm.toLowerCase())
    );

    return (
        <div className="flex h-full w-full bg-slate-50 dark:bg-black overflow-hidden relative border border-slate-100 dark:border-zinc-800 rounded-3xl shadow-lg">
            {/* Left sidebar: Rooms */}
            <div className="w-80 border-r border-slate-200 dark:border-zinc-800 flex flex-col bg-white dark:bg-zinc-900 shrink-0">
                <div className="p-4 border-b border-slate-150 dark:border-zinc-800 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-indigo-500" />
                            Team Chat
                        </h2>
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setSoundEnabled(!soundEnabled)}
                                title={soundEnabled ? "Mute notifications" : "Unmute notifications"}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl"
                            >
                                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                            </button>
                            <button
                                onClick={() => setShowNewChatModal(true)}
                                className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-xl font-bold flex items-center justify-center"
                                title="Start direct or channel chat"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search chats..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200/50 dark:border-zinc-700/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    <div className="flex gap-2 mb-2 px-2">
                        <button
                            onClick={() => setShowGroupModal(true)}
                            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 border border-dashed border-indigo-200 dark:border-indigo-900 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all"
                        >
                            <Users className="w-3.5 h-3.5" />
                            New Group
                        </button>
                    </div>

                    {filteredRooms.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 dark:text-zinc-600">
                            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p className="text-xs font-bold">No chats found</p>
                        </div>
                    ) : (
                        filteredRooms.map((room) => {
                            const active = activeRoom?.id === room.id;
                            const isOnline = isPeerOnline(room);
                            const displayName = getRoomDisplayName(room);
                            const avatar = getRoomAvatarUrl(room);

                            return (
                                <button
                                    key={room.id}
                                    onClick={() => setActiveRoom(room)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 group text-left ${active
                                        ? 'bg-slate-900 dark:bg-zinc-800 text-white shadow-md'
                                        : 'hover:bg-slate-50 dark:hover:bg-zinc-800/50 text-slate-600 dark:text-slate-300'
                                    }`}
                                >
                                    <div className="relative">
                                        {avatar ? (
                                            <img src={avatar} alt={displayName} className="w-10 h-10 rounded-xl object-cover" />
                                        ) : (
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${active ? 'bg-indigo-600 text-white' : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400'}`}>
                                                {room.type === 'department' ? (
                                                    <Hash className="w-4 h-4" />
                                                ) : room.type === 'group' ? (
                                                    <Users className="w-4 h-4" />
                                                ) : (
                                                    displayName.charAt(0)
                                                )}
                                            </div>
                                        )}
                                        {room.type === 'direct' && (
                                            <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-zinc-900 ${isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className={`text-xs font-bold truncate ${active ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                                            {displayName}
                                        </p>
                                        <p className="text-[10px] text-slate-400 truncate mt-0.5 capitalize">
                                            {room.type} Room
                                        </p>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Right: Message Window */}
            <div className="flex-1 flex flex-col bg-slate-50 dark:bg-zinc-950">
                {activeRoom ? (
                    <>
                        {/* Header */}
                        <div className="h-16 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 flex items-center justify-between z-10">
                            <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${activeRoom.type === 'direct' ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300'}`}>
                                    {activeRoom.type === 'department' ? <Hash className="w-4 h-4" /> : activeRoom.type === 'group' ? <Users className="w-4 h-4" /> : getRoomDisplayName(activeRoom).charAt(0)}
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{getRoomDisplayName(activeRoom)}</h3>
                                    <p className="text-[10px] text-slate-400 mt-0.5 font-medium flex items-center gap-1 capitalize">
                                        {activeRoom.type} Chat
                                        {activeRoom.type === 'direct' && isPeerOnline(activeRoom) && (
                                            <>
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                                                <span className="text-emerald-500 font-bold">Online</span>
                                            </>
                                        )}
                                    </p>
                                </div>
                            </div>

                            {activeRoom.type === 'group' && (
                                <div className="flex -space-x-2 overflow-hidden">
                                    {activeRoom.participants?.map((p, idx) => (
                                        <div key={p.profile_id} className="inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-zinc-900 bg-slate-200 dark:bg-zinc-800 overflow-hidden" title={p.profile?.full_name}>
                                            {p.profile?.avatar_url ? (
                                                <img src={p.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="h-full w-full flex items-center justify-center text-[8px] font-bold text-slate-500">
                                                    {p.profile?.full_name?.charAt(0) || 'U'}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-zinc-600">
                                    <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
                                    <p className="text-sm font-bold">No messages here yet</p>
                                    <p className="text-xs">Start the conversation by typing a message below.</p>
                                </div>
                            ) : (
                                messages.map((msg, index) => {
                                    const isMe = msg.sender_id === user?.id;
                                    const senderName = msg.sender?.full_name || 'User';
                                    const senderAvatar = msg.sender?.avatar_url;

                                    return (
                                        <div key={msg.id || index} className={`flex items-end gap-3 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            {!isMe && (
                                                <div className="h-8 w-8 rounded-xl bg-slate-200 dark:bg-zinc-800 overflow-hidden shrink-0">
                                                    {senderAvatar ? (
                                                        <img src={senderAvatar} alt="" className="h-full w-full object-cover" />
                                                    ) : (
                                                        <div className="h-full w-full flex items-center justify-center text-xs font-bold text-slate-500 uppercase">
                                                            {senderName.charAt(0)}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="max-w-[70%] space-y-1">
                                                {!isMe && (
                                                    <span className="text-[10px] text-slate-400 font-bold block ml-1">{senderName}</span>
                                                )}

                                                <div className={`p-3.5 rounded-2xl shadow-sm ${isMe
                                                    ? 'bg-slate-900 dark:bg-zinc-800 text-white rounded-br-none'
                                                    : 'bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 text-slate-800 dark:text-slate-200 rounded-bl-none'
                                                }`}>
                                                    {msg.message && (
                                                        <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                                                    )}

                                                    {msg.attachments && msg.attachments.length > 0 && (
                                                        <div className="space-y-2 mt-1">
                                                            {msg.attachments.map((att: any, idx: number) => (
                                                                <AttachmentPreview key={idx} attachment={att} />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                <span className="text-[9px] text-slate-400 font-medium block text-right px-1">
                                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Pending Attachments List */}
                        {pendingAttachments.length > 0 && (
                            <div className="bg-white dark:bg-zinc-900 border-t border-slate-150 dark:border-zinc-800 px-6 py-3 flex flex-wrap gap-3">
                                {pendingAttachments.map((att, idx) => (
                                    <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-zinc-800/80 rounded-xl text-xs border border-slate-100 dark:border-zinc-800 max-w-xs relative group pr-8">
                                        <FileText className="w-5 h-5 text-indigo-500 shrink-0" />
                                        <span className="truncate max-w-[150px] font-bold text-slate-700 dark:text-slate-200">{att.name}</span>
                                        <button
                                            onClick={() => removePendingAttachment(idx)}
                                            className="absolute right-1.5 top-1.5 p-1 bg-slate-200/50 hover:bg-slate-200 dark:bg-zinc-700/50 dark:hover:bg-zinc-600 rounded-full text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Input Box */}
                        <div className="p-4 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                            <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                    className={`p-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl shrink-0 ${uploading ? 'animate-pulse' : ''}`}
                                    title="Attach 10MB file"
                                >
                                    <Paperclip className="w-5 h-5" />
                                </button>

                                <input
                                    type="text"
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    placeholder={uploading ? "Uploading attachment..." : "Type your message..."}
                                    disabled={uploading}
                                    className="flex-1 px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200/50 dark:border-zinc-700/50 rounded-2xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                                />

                                <button
                                    type="submit"
                                    disabled={uploading || (!inputMessage.trim() && pendingAttachments.length === 0)}
                                    className="p-3 bg-slate-900 dark:bg-zinc-800 text-white hover:bg-slate-800 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-slate-900 rounded-xl shrink-0 transition-colors"
                                >
                                    <Send className="w-5 h-5" />
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-zinc-600">
                        <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
                        <h3 className="text-lg font-black text-slate-300 dark:text-zinc-700 mb-2">No Active Chat</h3>
                        <p className="text-xs max-w-xs text-center font-medium">Select a chat room or channel from the left sidebar to start messaging your team.</p>
                    </div>
                )}
            </div>

            {/* Modal: New Chat / Channels */}
            {showNewChatModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-md border border-slate-100 dark:border-zinc-800 shadow-2xl p-6 relative overflow-hidden animate-scale-in">
                        <button
                            onClick={() => { setShowNewChatModal(false); setModalSearchTerm(''); }}
                            className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <h3 className="text-lg font-black text-slate-800 dark:text-white mb-4">Start a Chat</h3>

                        {/* Search Contacts */}
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search employees..."
                                value={modalSearchTerm}
                                onChange={(e) => setModalSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200/50 dark:border-zinc-700/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>

                        <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                            {/* Channels / Departments */}
                            {departments.length > 0 && !modalSearchTerm && (
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">Department Channels</p>
                                    {departments.map((dept) => (
                                        <button
                                            key={dept.id}
                                            onClick={() => handleSelectDepartment(dept.id, dept.name)}
                                            className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 text-left transition-colors text-slate-700 dark:text-slate-300 font-bold text-xs"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                                                <Hash className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="truncate">{dept.name}</p>
                                                <p className="text-[9px] text-slate-400 font-medium">#{dept.code}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Direct Message Contacts */}
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">Direct Message</p>
                                {filteredProfiles.length === 0 ? (
                                    <p className="text-xs text-slate-400 dark:text-zinc-600 py-4 text-center font-medium">No contacts found</p>
                                ) : (
                                    filteredProfiles.map((prof) => (
                                        <button
                                            key={prof.id}
                                            onClick={() => handleSelectContact(prof.id)}
                                            className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 text-left transition-colors text-slate-700 dark:text-slate-300 font-bold text-xs"
                                        >
                                            {prof.avatar_url ? (
                                                <img src={prof.avatar_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                                                    {prof.full_name?.charAt(0) || 'U'}
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="truncate flex items-center gap-1.5">
                                                    {prof.full_name}
                                                    {!prof.hasAccount && (
                                                        <span className="px-1.5 py-0.5 text-[8px] bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-full font-black border border-amber-200/40">
                                                            Pending Sign-up
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-[9px] text-slate-400 font-medium truncate">{prof.role}</p>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: New Group */}
            {showGroupModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-md border border-slate-100 dark:border-zinc-800 shadow-2xl p-6 relative overflow-hidden animate-scale-in">
                        <button
                            onClick={() => { setShowGroupModal(false); setGroupName(''); setSelectedGroupMembers([]); }}
                            className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <h3 className="text-lg font-black text-slate-800 dark:text-white mb-4">Create Group Chat</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Group Name</label>
                                <input
                                    type="text"
                                    placeholder="Enter group name..."
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200/50 dark:border-zinc-700/50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                                />
                            </div>

                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">Select Members</p>
                                <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                                    {profiles.filter(p => !p.id.startsWith('emp_')).map((prof) => {
                                        const selected = selectedGroupMembers.includes(prof.id);
                                        return (
                                            <button
                                                key={prof.id}
                                                onClick={() => toggleGroupMember(prof.id)}
                                                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors text-xs font-bold ${selected
                                                    ? 'bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400'
                                                    : 'hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-slate-300'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    {prof.avatar_url ? (
                                                        <img src={prof.avatar_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center font-bold">
                                                            {prof.full_name?.charAt(0) || 'U'}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="truncate">{prof.full_name}</p>
                                                        <p className="text-[9px] text-slate-400 font-medium capitalize">{prof.role || 'Employee'}</p>
                                                    </div>
                                                </div>
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selected ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-300'}`}>
                                                    {selected && <span className="text-[9px] font-bold">✓</span>}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <button
                                onClick={handleCreateGroup}
                                disabled={!groupName.trim() || selectedGroupMembers.length === 0}
                                className="w-full py-3 bg-slate-900 dark:bg-zinc-800 text-white hover:bg-slate-800 dark:hover:bg-zinc-700 disabled:opacity-40 rounded-xl text-xs font-bold transition-colors"
                            >
                                Create Group
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamChat;
