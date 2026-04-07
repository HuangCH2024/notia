import React, { useState, useEffect, useRef } from 'react';
import {
    Typography, Box, TextField, IconButton,
    Badge, Button, Snackbar, Alert, Slide, type SlideProps, Tooltip
} from '@mui/material';
import {
    ChatBubbleOutline, ContactSupport, AddCircleOutline, Send, Close
} from '@mui/icons-material';
import { AnimatePresence, motion } from 'framer-motion';

import { supabase } from './assets/components/supabase';
import { MessageTag } from './assets/components/MessageTag';

function SlideUp(props: SlideProps) {
    return <Slide {...props} direction="up" />;
}

export default function App() {
    const [messages, setMessages] = useState<any[]>([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [openDialog, setOpenDialog] = useState(false);
    const [viewCount, setViewCount] = useState(0);
    const [showSuccess, setShowSuccess] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [openError, setOpenError] = useState(false);

    // --- 状态控制 ---
    const [username, setUsername] = useState('');
    const [content, setContent] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const [feedbackContact, setFeedbackContact] = useState('');
    const [feedbackContent, setFeedbackContent] = useState('');
    const [isSendingFeedback, setIsSendingFeedback] = useState(false);

    // --- 画布逻辑 ---
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const hasIncremented = useRef(false);

    const handleError = (msg: string) => {
        setErrorMsg(msg);
        setOpenError(true);
    };

    useEffect(() => {
        const initPage = async () => {
            if (!hasIncremented.current) {
                hasIncremented.current = true;
                try { await supabase.rpc('increment_views'); } catch (e) { }
            }
            const { data: stats } = await supabase.from('site_stats').select('views_count').single();
            if (stats) setViewCount(stats.views_count);
            const { data } = await supabase.from('messages').select('*').order('z_index', { ascending: true });
            if (data) setMessages(data);
        };
        initPage();

        const handleKeyDown = (e: KeyboardEvent) => {
            const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
            if (e.code === 'Space' && !isInput && !isSidebarOpen && !openDialog) {
                e.preventDefault();
                setIsSpacePressed(true);
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') setIsSpacePressed(false);
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        const channel = supabase.channel('db-changes')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
                setMessages(prev => [...prev, payload.new]);
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
                setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
                setMessages(prev => prev.filter(m => m.id !== payload.old.id));
            })
            .subscribe();

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            supabase.removeChannel(channel);
        };
    }, [isSidebarOpen, openDialog]);

    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        if (isSpacePressed) {
            setIsDraggingCanvas(true);
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        }
    };

    const handleCanvasMouseMove = (e: React.MouseEvent) => {
        if (isDraggingCanvas && scrollContainerRef.current) {
            const dx = e.clientX - lastMousePos.current.x;
            const dy = e.clientY - lastMousePos.current.y;
            scrollContainerRef.current.scrollLeft -= dx;
            scrollContainerRef.current.scrollTop -= dy;
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        }
    };

    const handleCanvasMouseUp = () => setIsDraggingCanvas(false);

    const handleStop = async (id: string, x: number, y: number) => {
        setMessages(prev => prev.map(m => m.id === id ? { ...m, pos_x: x, pos_y: y } : m));
        await supabase.from('messages').update({ pos_x: x, pos_y: y }).eq('id', id);
    };

    const handleFocus = async (id: string) => {
        const currentMaxZ = messages.length > 0 ? Math.max(...messages.map(m => m.z_index || 0)) : 10;
        const newZ = currentMaxZ + 1;
        setMessages(prev => prev.map(m => m.id === id ? { ...m, z_index: newZ } : m));
        await supabase.from('messages').update({ z_index: newZ }).eq('id', id);
    };

    const handleSubmit = async () => {
        if (!username.trim() || !content.trim()) return handleError("署名和内容不能为空哦！");
        setLoading(true);
        let stickerUrl = '';
        try {
            if (file) {
                const fileExt = file.name.split('.').pop();
                const cleanFileName = file.name.split('.').slice(0, -1).join('.').replace(/[^a-z0-9]/gi, '_').toLowerCase();
                const fileName = `${Date.now()}-${cleanFileName}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('stickers').upload(fileName, file);
                if (uploadError) throw uploadError;
                const { data: pUrl } = supabase.storage.from('stickers').getPublicUrl(fileName);
                stickerUrl = pUrl.publicUrl;
            }
            const maxZ = messages.length > 0 ? Math.max(...messages.map(m => m.z_index || 0)) : 10;
            await supabase.from('messages').insert([{
                username, content, sticker_url: stickerUrl,
                pos_x: Math.floor(Math.random() * 2100),
                pos_y: Math.floor(Math.random() * 1100),
                z_index: maxZ + 1
            }]);
            setOpenDialog(false); setShowSuccess(true); setContent(''); setPreview(null); setFile(null);
        } catch (err: any) { handleError(err.message); } finally { setLoading(false); }
    };

    const handleFeedbackSubmit = async () => {
        if (!feedbackContent.trim()) return handleError("反馈内容不能为空哦！");
        setIsSendingFeedback(true);
        try {
            const { error } = await supabase.from('feedback').insert([{
                contact_info: feedbackContact,
                suggestion: feedbackContent,
                user_agent: navigator.userAgent
            }]);
            if (error) throw error;
            setShowSuccess(true); setFeedbackContact(''); setFeedbackContent(''); setIsSidebarOpen(false);
        } catch (err: any) { handleError("提交失败：" + err.message); } finally { setIsSendingFeedback(false); }
    };

    const scrollBoxSx = {
        maxHeight: '60vh',
        overflowY: 'auto',
        pr: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 2.5,
        '&::-webkit-scrollbar': { width: '6px' },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(0,0,0,0.1)', borderRadius: '10px' }
    };

    const tooltipProps = {
        slotProps: { popper: { sx: { zIndex: 10000 } } },
        arrow: true,
        placement: "bottom" as const
    };

    return (
        <Box sx={{ width: '100vw', height: '100vh', overflow: 'hidden', bgcolor: '#f5f7f9', position: 'relative' }}>

            {/* 顶部药丸导航栏 */}
            <Box sx={{
                position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
                minWidth: { xs: '92%', sm: '560px' }, height: '64px', bgcolor: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(12px)', borderRadius: '32px', boxShadow: '0 10px 40px rgba(0,0,0,0.06)',
                border: '1px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography variant="h5" sx={{ fontWeight: 900, color: 'primary.main', letterSpacing: -1 }}>NOTIA</Typography>
                    <Box sx={{ px: 1.2, py: 0.4, bgcolor: 'primary.main', color: 'white', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 900 }}>
                        {viewCount} VIEWS
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TextField size="small" placeholder="署名..." variant="standard" value={username} onChange={e => setUsername(e.target.value)}
                               InputProps={{ disableUnderline: true }} sx={{ width: 100, bgcolor: 'rgba(0,0,0,0.04)', px: 1.2, py: 0.4, borderRadius: '6px' }} />
                    <Tooltip title="投递贴纸" {...tooltipProps}>
                        <IconButton color="primary" onClick={() => setOpenDialog(true)}><AddCircleOutline /></IconButton>
                    </Tooltip>
                    <Tooltip title={`共有 ${messages.length} 条消息`} {...tooltipProps}>
                        <Badge badgeContent={messages.length} color="error" sx={{ mx: 2 }}>
                            <ChatBubbleOutline fontSize="small" />
                        </Badge>
                    </Tooltip>
                    <Tooltip title="建议反馈" {...tooltipProps}>
                        <IconButton color="primary" onClick={() => setIsSidebarOpen(true)}><ContactSupport /></IconButton>
                    </Tooltip>
                </Box>
            </Box>

            {/* 画布区域 - 包含自定义滚动条 */}
            <Box
                ref={scrollContainerRef}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                sx={{
                    width: '100%', height: '100%', overflow: 'auto',
                    cursor: isSpacePressed ? (isDraggingCanvas ? 'grabbing' : 'grab') : 'default',
                    '&::-webkit-scrollbar': { width: '8px', height: '8px' },
                    '&::-webkit-scrollbar-track': { background: 'transparent' },
                    '&::-webkit-scrollbar-thumb': {
                        backgroundColor: 'rgba(0, 0, 0, 0.1)',
                        borderRadius: '10px',
                        border: '2px solid transparent',
                        backgroundClip: 'content-box',
                        '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.2)' }
                    },
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgba(0, 0, 0, 0.1) transparent'
                }}
            >
                <Box sx={{
                    width: '2560px', height: '1440px', position: 'relative',
                    backgroundImage: 'radial-gradient(#d1d5db 1px, transparent 0)', backgroundSize: '40px 40px',
                    '& > *': { pointerEvents: isSpacePressed ? 'none' : 'auto' }
                }}>
                    {messages.map((msg) => (
                        <MessageTag key={msg.id} data={msg} onFocus={handleFocus} onStop={handleStop} />
                    ))}
                </Box>
            </Box>

            {/* 统一弹窗系统 */}
            <AnimatePresence>
                {(isSidebarOpen || openDialog) && (
                    <>
                        <Box component={motion.div} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                             onClick={() => { if (!loading && !isSendingFeedback) { setIsSidebarOpen(false); setOpenDialog(false); } }}
                             sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', zIndex: 20000 }} />

                        {/* 反馈窗口 */}
                        {isSidebarOpen && (
                            <Box component={motion.div} initial={{ opacity: 0, scale: 0.9, y: 20, x: '-50%' }} animate={{ opacity: 1, scale: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, scale: 0.9, y: 20, x: '-50%' }}
                                 sx={{ position: 'fixed', top: '15%', left: '50%', zIndex: 20001, width: { xs: '92%', sm: '480px' }, bgcolor: 'white', p: 4, borderRadius: '32px', boxShadow: '0 30px 60px -12px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography variant="h5" fontWeight="900" color="primary">建议与反馈</Typography>
                                    <IconButton onClick={() => setIsSidebarOpen(false)} sx={{ bgcolor: '#f5f5f5' }}><Close fontSize="small" /></IconButton>
                                </Box>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                                    <TextField fullWidth label="如何联系您？" variant="outlined" value={feedbackContact} onChange={e => setFeedbackContact(e.target.value)} sx={{ "& .MuiOutlinedInput-root": { borderRadius: '14px' } }} />
                                    <TextField fullWidth label="想说点什么..." multiline rows={5} variant="outlined" value={feedbackContent} onChange={e => setFeedbackContent(e.target.value)} sx={{ "& .MuiOutlinedInput-root": { borderRadius: '14px' } }} />
                                    <Button variant="contained" fullWidth size="large" disabled={isSendingFeedback} sx={{ py: 2, borderRadius: '16px', fontWeight: 'bold' }} onClick={handleFeedbackSubmit}>
                                        {isSendingFeedback ? '发送中...' : '提交反馈'}
                                    </Button>
                                </Box>
                            </Box>
                        )}

                        {/* 发布窗口 */}
                        {openDialog && (
                            <Box component={motion.div} initial={{ opacity: 0, scale: 0.9, y: 20, x: '-50%' }} animate={{ opacity: 1, scale: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, scale: 0.9, y: 20, x: '-50%' }}
                                 sx={{ position: 'fixed', top: '10%', left: '50%', zIndex: 20001, width: { xs: '92%', sm: '480px' }, bgcolor: 'white', p: 4, borderRadius: '32px', boxShadow: '0 30px 60px -12px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography variant="h5" fontWeight="900" color="primary">发布新贴纸</Typography>
                                    <IconButton onClick={() => setOpenDialog(false)} sx={{ bgcolor: '#f5f5f5' }}><Close fontSize="small" /></IconButton>
                                </Box>
                                <Box sx={scrollBoxSx}>
                                    <TextField fullWidth multiline rows={4} placeholder="写点什么..." value={content} onChange={e => setContent(e.target.value)} sx={{ "& .MuiOutlinedInput-root": { borderRadius: '18px', bgcolor: '#f9f9f9' } }} />
                                    {!preview ? (
                                        <Button component="label" fullWidth variant="outlined" sx={{ py: 5, borderStyle: 'dashed', borderRadius: '18px', borderColor: '#ddd', color: 'text.secondary' }}>
                                            + 点击上传图片
                                            <input type="file" hidden accept="image/*" onChange={(e) => {
                                                const f = e.target.files?.[0];
                                                if (f) {
                                                    const img = new Image();
                                                    img.src = URL.createObjectURL(f);
                                                    img.onload = () => {
                                                        if (img.width > 512 || img.height > 512) {
                                                            handleError(`尺寸过大 (${img.width}x${img.height})，请限制在 512x512 内`);
                                                            URL.revokeObjectURL(img.src);
                                                            e.target.value = ''; return;
                                                        }
                                                        setFile(f); setPreview(img.src);
                                                    };
                                                }
                                            }} />
                                        </Button>
                                    ) : (
                                        <Box sx={{ position: 'relative' }}>
                                            <Box component="img" src={preview} sx={{ width: '100%', borderRadius: '18px', display: 'block', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                            <IconButton onClick={() => { setFile(null); setPreview(null); }} sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(255,255,255,0.9)' }} size="small"><Close fontSize="small" /></IconButton>
                                        </Box>
                                    )}
                                </Box>
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <Button fullWidth variant="text" onClick={() => setOpenDialog(false)} sx={{ fontWeight: 'bold', borderRadius: '12px' }}>取消</Button>
                                    <Button variant="contained" fullWidth size="large" onClick={handleSubmit} disabled={loading} sx={{ py: 1.5, borderRadius: '16px', fontWeight: 'bold' }}>
                                        {loading ? '发布中...' : '确认投递'}
                                    </Button>
                                </Box>
                            </Box>
                        )}
                    </>
                )}
            </AnimatePresence>

            <Snackbar open={showSuccess} autoHideDuration={3000} onClose={() => setShowSuccess(false)} sx={{ zIndex: 30000 }} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} TransitionComponent={SlideUp}>
                <Alert severity="success" variant="filled" sx={{ width: '100%', borderRadius: '16px' }}>操作成功！</Alert>
            </Snackbar>
            <Snackbar open={openError} autoHideDuration={5000} onClose={() => setOpenError(false)} sx={{ zIndex: 30000 }} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} TransitionComponent={SlideUp}>
                <Alert severity="error" variant="filled" sx={{ width: '100%', borderRadius: '16px' }}>{errorMsg}</Alert>
            </Snackbar>
        </Box>
    );
}