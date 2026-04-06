import React, { useState, useEffect, useRef } from 'react';
import {
  Typography, Box, TextField, IconButton,
  Badge, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar, Alert, Slide, type SlideProps
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

  const [username, setUsername] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // --- 画布拖拽相关状态 ---
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const hasIncremented = useRef(false);

  const handleError = (msg: string) => {
    setErrorMsg(msg);
    setOpenError(true);
  };

  // 1. 初始化数据与全局事件
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

    // 空格键监听：增加输入框屏蔽逻辑
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.code === 'Space' && !isInput) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpacePressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Supabase 实时同步
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
  }, []);

  // --- 画布拖拽交互逻辑 ---
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
    if (!username.trim() || !content.trim()) return handleError("请填写署名和内容哦！");
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
            <Box sx={{ px: 1.2, py: 0.4, bgcolor: 'primary.main', fontFamily: 'Console', color: 'white', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              有 <Box component="span" sx={{ fontWeight: 900 , color: 'yellow', fontFamily: 'inherit' }}>{viewCount}</Box> 位访客看过哦
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <TextField size="small" placeholder="发布前先署名" variant="standard" value={username} onChange={e => setUsername(e.target.value)}
                       InputProps={{ disableUnderline: true }} sx={{ width: 120, bgcolor: 'rgba(0,0,0,0.04)', px: 1.2, py: 0.4, borderRadius: '6px' }} />
            <IconButton color="primary" onClick={() => setOpenDialog(true)}><AddCircleOutline /></IconButton>
            <Badge badgeContent={messages.length} color="error" sx={{ mx: 2 }}><ChatBubbleOutline fontSize="small" /></Badge>
            <IconButton color="primary" onClick={() => setIsSidebarOpen(true)}><ContactSupport /></IconButton>
          </Box>
        </Box>

        {/* 滚动容器 & 自定义滚动条 */}
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
            '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
            '&::-webkit-scrollbar-thumb': { bgcolor: '#d1d5db', borderRadius: '10px', '&:hover': { bgcolor: '#9ca3af' } },
            scrollbarWidth: 'thin', scrollbarColor: '#d1d5db transparent'
          }}
        >
          {/* 固定 2K 画布容器 */}
          <Box sx={{ 
            width: '2560px', height: '1440px', position: 'relative', 
            backgroundImage: 'radial-gradient(#d1d5db 1px, transparent 0)', backgroundSize: '40px 40px',
            // 核心：按住空格时，禁止贴纸响应鼠标，防止误触发拖拽
            '& > *': { pointerEvents: isSpacePressed ? 'none' : 'auto' }
          }}>
            {messages.map((msg) => (
                <MessageTag key={msg.id} data={msg} onFocus={handleFocus} onStop={handleStop} />
            ))}
          </Box>
        </Box>

        {/* 居中反馈窗口 */}
        <AnimatePresence>
          {isSidebarOpen && (
              <>
                <Box component={motion.div} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                     onClick={() => setIsSidebarOpen(false)} 
                     sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(6px)', zIndex: 20000 }} />
                <Box 
                    component={motion.div} initial={{ opacity: 0, scale: 0.9, y: 20, x: '-50%' }} animate={{ opacity: 1, scale: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, scale: 0.9, y: 20, x: '-50%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    sx={{ position: 'fixed', top: '20%', left: '50%', zIndex: 20001, width: { xs: '90%', sm: '450px' }, bgcolor: 'white', p: 4, borderRadius: '28px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: 3 }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h5" fontWeight="900" color="primary">建议与反馈</Typography>
                    <IconButton onClick={() => setIsSidebarOpen(false)} sx={{ bgcolor: '#f5f5f5' }}><Close /></IconButton>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                    <TextField fullWidth label="如何联系您？" variant="outlined" sx={{ "& .MuiOutlinedInput-root": { borderRadius: '12px' } }} />
                    <TextField fullWidth label="想说点什么..." multiline rows={5} variant="outlined" sx={{ "& .MuiOutlinedInput-root": { borderRadius: '12px' } }} />
                    <Button variant="contained" fullWidth size="large" sx={{ py: 1.8, borderRadius: '14px', fontWeight: 'bold' }} onClick={() => { setIsSidebarOpen(false); setShowSuccess(true); }} endIcon={<Send />}>提交反馈</Button>
                  </Box>
                </Box>
              </>
          )}
        </AnimatePresence>

        {/* 发布贴纸 Dialog */}
        <Dialog open={openDialog} onClose={() => !loading && setOpenDialog(false)} fullWidth maxWidth="xs" sx={{ zIndex: 10001 }} PaperProps={{ sx: { borderRadius: '24px', p: 1 } }}>
          <DialogTitle sx={{ fontWeight: 800, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            ✨ 发布消息
            {!loading && <IconButton onClick={() => setOpenDialog(false)} size="small"><Close fontSize="small" /></IconButton>}
          </DialogTitle>
          <DialogContent dividers sx={{ borderBottom: 'none' }}>
            <TextField fullWidth multiline rows={4} placeholder="写点什么..." value={content} onChange={e => setContent(e.target.value)} sx={{ "& .MuiOutlinedInput-root": { borderRadius: '16px', bgcolor: '#f9f9f9' } }} />
            {!preview ? (
              <Button component="label" fullWidth variant="outlined" sx={{ mt: 3, py: 4, borderStyle: 'dashed', borderRadius: '16px', borderColor: '#ddd' }}>
                + 上传图片
                <input type="file" hidden accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setPreview(URL.createObjectURL(f)); } }} />
              </Button>
            ) : (
              <Box sx={{ mt: 3, position: 'relative' }}>
                <Box component="img" src={preview} sx={{ width: '100%', borderRadius: '16px', display: 'block', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <IconButton onClick={() => { setFile(null); setPreview(null); }} sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(255,255,255,0.9)', '&:hover': { bgcolor: '#fff', color: 'error.main' }, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }} size="small"><Close fontSize="small" /></IconButton>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 0 }}>
            <Button onClick={() => setOpenDialog(false)} color="inherit" sx={{ fontWeight: 'bold' }}>取消</Button>
            <Button variant="contained" onClick={handleSubmit} disabled={loading} sx={{ borderRadius: '12px', px: 4, fontWeight: 'bold' }}>{loading ? '处理中...' : '确认投递'}</Button>
          </DialogActions>
        </Dialog>

        {/* 全局通知 */}
        <Snackbar open={showSuccess} autoHideDuration={3000} onClose={() => setShowSuccess(false)} sx={{ zIndex: 20002 }} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} TransitionComponent={SlideUp}>
          <Alert severity="success" variant="filled" sx={{ width: '100%', borderRadius: '12px' }}>贴纸已上墙！</Alert>
        </Snackbar>
        <Snackbar open={openError} autoHideDuration={5000} onClose={() => setOpenError(false)} sx={{ zIndex: 20002 }} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} TransitionComponent={SlideUp}>
          <Alert severity="error" variant="filled" sx={{ width: '100%', borderRadius: '12px' }}>{errorMsg}</Alert>
        </Snackbar>
      </Box>
  );
}