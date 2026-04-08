import React, { useState, useEffect, useRef } from 'react';
import {
    Typography, Box, TextField, IconButton,
    Badge, Button, Snackbar, Alert, Slide, type SlideProps, Tooltip,
    useMediaQuery, Fab, Zoom , Link
} from '@mui/material';
import {
    ChatBubbleOutline, ContactSupport, AddCircleOutline, Close, EditNote
} from '@mui/icons-material';
import { AnimatePresence, motion } from 'framer-motion';
import { TouchApp } from '@mui/icons-material';

import { PanTool, BackHand , AdsClick} from '@mui/icons-material';
import { supabase } from './assets/components/supabase';
import { MessageTag } from './assets/components/MessageTag';

// 导入压缩库
import imageCompression from 'browser-image-compression';

function SlideUp(props: SlideProps) {
    return <Slide {...props} direction="up" />;
}

export default function App() {
    // const theme = useTheme();
    const isMobile = useMediaQuery('(max-width:450px)');

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
    const [openNameDialog, setOpenNameDialog] = useState(false);

    const [feedbackContact, setFeedbackContact] = useState('');
    const [feedbackContent, setFeedbackContent] = useState('');
    const [, setIsSendingFeedback] = useState(false);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const hasIncremented = useRef(false);
    const [manualLock, setManualLock] = useState(false);
    const isLocked = isSpacePressed || manualLock;
    // 默认从 0 开始渲染
const [displayLimit, setDisplayLimit] = useState(0);

    const handleError = (msg: string) => {
        setErrorMsg(msg);
        setOpenError(true);
    };

    const transitionConfig = {
        type: "tween",
        ease: "easeInOut",
        duration: 0.15
    } as const;


    // --- 新增：图片强制压缩处理函数 ---
    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const originFile = e.target.files?.[0];
        if (!originFile) return;

        // 压缩配置：强制宽高不超过 512，且维持比例
        const options = {
            maxSizeMB: 0.8,         // 最大约 800KB
            maxWidthOrHeight: 512,  // 强制缩放到 512px 以内
            useWebWorker: true,
            initialQuality: 0.8     // 压缩质量
        };

        try {
            setLoading(true);
            const compressedBlob = await imageCompression(originFile, options);
            
            // 将压缩后的 Blob 转换为 File 对象以便上传
            const finalFile = new File([compressedBlob], originFile.name, {
                type: originFile.type,
            });

            setFile(finalFile);
            setPreview(URL.createObjectURL(finalFile));
        } catch (error) {
            handleError("图片处理失败，请重试");
            console.error(error);
        } finally {
            setLoading(false);
        }
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
            if (e.code === 'Space' && !isInput && !isSidebarOpen && !openDialog && !openNameDialog) {
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
    }, [isSidebarOpen, openDialog, openNameDialog]);

    // const handleCanvasMouseDown = (e: React.MouseEvent) => {
    //     if (isSpacePressed) {
    //         setIsDraggingCanvas(true);
    //         lastMousePos.current = { x: e.clientX, y: e.clientY };
    //     }
    // };

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
        // --- 1. 图片上传逻辑 (保持不变) ---
        if (file) {
            const fileExt = file.name.split('.').pop();
            const cleanFileName = file.name.split('.').slice(0, -1).join('.').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const fileName = `${Date.now()}-${cleanFileName}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('stickers').upload(fileName, file);
            if (uploadError) throw uploadError;
            const { data: pUrl } = supabase.storage.from('stickers').getPublicUrl(fileName);
            stickerUrl = pUrl.publicUrl;
        }

        // --- 2. 核心逻辑：计算视口中心坐标 ---
        const container = scrollContainerRef.current;
        let finalX = 1000; // 默认回退值
        let finalY = 500;

        if (container) {
            const { scrollLeft, scrollTop, clientWidth, clientHeight } = container;
            
            // 计算视口中心
            const centerX = scrollLeft + clientWidth / 2;
            const centerY = scrollTop + clientHeight / 2;

            // 设置偏移范围（例如：正负 60px 之间随机）
            const jitter = () => (Math.random() - 0.5) * 120;

            // 最终坐标（考虑到贴纸自身的宽度，可以适当减去一些偏移，让它更居中）
            finalX = centerX + jitter() - 100; // 假设贴纸宽约200
            finalY = centerY + jitter() - 100;
        }

        const maxZ = messages.length > 0 ? Math.max(...messages.map(m => m.z_index || 0)) : 10;

        // --- 3. 提交到 Supabase ---
        await supabase.from('messages').insert([{
            username, 
            content, 
            sticker_url: stickerUrl,
            pos_x: Math.floor(finalX),
            pos_y: Math.floor(finalY),
            z_index: maxZ + 1
        }]);

        setOpenDialog(false); 
        setShowSuccess(true); 
        setContent(''); 
        setPreview(null); 
        setFile(null);
    } catch (err: any) { 
        handleError(err.message); 
    } finally { 
        setLoading(false); 
    }
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

    const mobileSheetSx = {
        position: 'fixed',
        bottom: 0,
        left: '50%',
        zIndex: 20001,
        width: '100%',
        maxWidth: '500px',
        bgcolor: 'white',
        px: 3, py: 4, pb: 6,
        borderTopLeftRadius: '28px',
        borderTopRightRadius: '28px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        boxShadow: '0 -10px 40px rgba(0,0,0,0.1)'
    };

    const pcModalSx = {
        position: 'fixed',
        top: '15%',
        left: '50%',
        zIndex: 20001,
        width: { xs: '92%', sm: '480px' },
        bgcolor: 'white',
        p: 4,
        borderRadius: '32px',
        boxShadow: '0 30px 60px -12px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        gap: 3
    };

    useEffect(() => {
    // 如果当前显示的贴纸少于总数，则启动定时器
    if (displayLimit < messages.length) {
        const timer = setTimeout(() => {
            // 每次增加的数量可以根据性能调整，例如每次 +1 或 +5
            setDisplayLimit(prev => prev + 3); 
        }, 300); // 间隔 30ms 渲染下一批，给浏览器留出响应时间

        return () => clearTimeout(timer);
    }
}, [messages.length, displayLimit]);

// 补充：当重新获取数据或切换画板时，记得重置 displayLimit
useEffect(() => {
    setDisplayLimit(0);
}, [messages.length === 0]);

    return (
        <Box sx={{ width: '100vw', height: '100vh', overflow: 'hidden', bgcolor: '#f5f7f9', position: 'relative' }}>

            {/* 顶部药丸导航栏 */}
            <Box sx={{
                position: 'fixed', top: isMobile ? 16 : 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
                width: isMobile ? 'calc(100% - 62px)' : 'auto',
                minWidth: isMobile ? '0' : '560px',
                height: '64px', bgcolor: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(12px)', borderRadius: '32px', boxShadow: '0 10px 40px rgba(0,0,0,0.06)',
                border: '1px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', pl: isMobile ? 1.5 : 3, pr: 2,
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: isMobile ? 1 : 1.5 }}>
                    <Typography variant="h5" sx={{ fontWeight: 900, color: 'primary.main', letterSpacing: -1, paddingX: isMobile ? 1 : 0, fontSize: isMobile ? '1.1rem' : '1.5rem', whiteSpace: 'nowrap' }}>NOTIA</Typography>
                    <Box sx={{ px: 1, py: 0.3, bgcolor: 'primary.main', fontFamily: "Arial", color: 'white', borderRadius: '8px', fontSize: isMobile ? '0.6rem' : '0.8rem', fontWeight: 900, whiteSpace: 'nowrap' }}>
                        {viewCount} 人看过
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, paddingX: isMobile ? 0.8 : 0, height: '100%' }}>
                    {!isMobile && (
                        <>
                            <TextField size="small" placeholder="发布前先署名" variant="standard" value={username} onChange={e => setUsername(e.target.value)}
                                InputProps={{ disableUnderline: true }} sx={{ width: 100, bgcolor: 'rgba(0,0,0,0.04)', px: 1.2, py: 0.4, borderRadius: '6px' }} />
                                <Tooltip title={manualLock ? "当前：移动画布 (贴纸已锁定)" : "当前：自由交互"} arrow slotProps={{ popper: { sx: { zIndex: 20003 } } }}>
                    <IconButton 
                        onClick={() => setManualLock(!manualLock)} 
                        sx={{ 
                            mx: 0.5, 
                            color: manualLock ? 'secondary.main' : 'primary.main',
                            bgcolor: manualLock ? 'rgba(156, 39, 176, 0.08)' : 'transparent', // 激活时给个淡淡的背景色
                            '&:hover': { bgcolor: manualLock ? 'rgba(156, 39, 176, 0.12)' : 'rgba(0,0,0,0.04)' }
                        }}
                    >
                        {manualLock ? <BackHand fontSize="small" /> : < AdsClick fontSize="small" />}
                    </IconButton>
                </Tooltip>
                            <Tooltip title={`共有 ${messages.length} 条消息`} arrow slotProps={{
    popper: {
      sx: {
        zIndex: 20003,
      },
          modifiers: [
      {
        name: 'offset',
        options: {
          offset: [0, 8]  // 向上移动 12px，让 Tooltip 更贴近触发元素
        }
      }
    ]
    },
  }}>
                                <Badge badgeContent={messages.length} color="error" sx={{ mx: 1.5, my: 1 }}>
                                    <ChatBubbleOutline fontSize="small" />
                                </Badge>
                            </Tooltip>
                            <Tooltip title="建议反馈" arrow slotProps={{
    popper: {
      sx: {
        zIndex: 20003,
      },
    },
  }}>
                                <IconButton color="primary" onClick={() => setIsSidebarOpen(true)}><ContactSupport /></IconButton>
                            </Tooltip>
                        </>
                    )}
                    {isMobile && (
                        <Badge badgeContent={messages.length} color="error" sx={{ mr: 0.5, '& .MuiBadge-badge': { fontSize: '0.6rem', height: '16px', minWidth: '16px' } }}>
                            <ChatBubbleOutline color="action" />
                        </Badge>
                    )}
 <Tooltip title="建议反馈" arrow slotProps={{
    popper: {
      sx: {
        zIndex: 20003,
      },
    },
  }}>
                    <IconButton
                        color="primary"
                        onClick={() => setOpenDialog(true)}
                        size="medium"
                        sx={{
                            p: 1,
                            display: isMobile ? "none" : "flex"
                        }}
                    >
                        <AddCircleOutline />
                    </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            {/* 画布区域 */}
            <Box ref={scrollContainerRef} 
    onMouseDown={(e) => {
        if (isLocked) { // 修改这里
            setIsDraggingCanvas(true);
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        }
    }}
    onMouseMove={handleCanvasMouseMove} 
    onMouseUp={handleCanvasMouseUp} 
    onMouseLeave={handleCanvasMouseUp}

    sx={{ 
        width: '100%', 
        height: '100%', 
        overflow: 'auto', 
        cursor: isLocked ? 'grab' : 'default',
        // --- 新增：自定义滚动条样式 ---
        '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
        },
        '&::-webkit-scrollbar-track': {
            backgroundColor: 'rgba(0,0,0,0.05)',
        },
        '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0,0,0,0.2)',
            borderRadius: '10px',
            '&:hover': {
                backgroundColor: 'rgba(0,0,0,0.3)',
            },
        },
        // 兼容 Firefox
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(0,0,0,0.2) rgba(0,0,0,0.05)',
    }}>
                <Box sx={{ width: '2560px', height: '1440px', position: 'relative', backgroundImage: 'radial-gradient(#d1d5db 1px, transparent 0)', backgroundSize: '40px 40px', '& > *': {
            pointerEvents: isLocked ? 'none' : 'auto',
        }}}>
                    {messages.slice(0, displayLimit).map((msg) => (
        <MessageTag 
            key={msg.id} 
            data={msg} 
            onFocus={handleFocus} 
            onStop={handleStop} 
        />
    ))}
                </Box>
            </Box>

            {/* 移动端 FAB */}
            <Zoom in={isMobile} unmountOnExit>
                <Box sx={{ position: 'fixed', bottom: 20, right: 20, zIndex: 10000, display: 'flex', flexDirection: 'column', gap: 2 }}>
    {/*第四个: 手动关闭 贴纸移动 */}
<Fab 
        color={manualLock ? "secondary" : "default"} 
        onClick={() => setManualLock(!manualLock)}
        sx={{ bgcolor: manualLock ? undefined : 'white' }}
    >
        {manualLock ? (
            <PanTool sx={{ color: 'white' }} /> // 移动画布模式
        ) : (
            <TouchApp color="primary" /> // 自由交互模式
        )}
    </Fab>

  {/* 第一个：蓝色背景 + 白色图标 */}
  <Fab color="primary" onClick={() => setOpenDialog(true)}>
    <AddCircleOutline sx={{ color: 'white' }} />
  </Fab>

  
  {/* 第三个：根据 username 动态切换样式 */}
  <Fab 
    color={username.trim() ? "default" : "warning"}
    onClick={() => setOpenNameDialog(true)}
    sx={{ 
      bgcolor: username.trim() ? 'white' : undefined  // 有用户名时白色背景
    }}
  >
    {username.trim() ? (
      <EditNote color="primary" />  // 有用户名：蓝色图标
    ) : (
      <EditNote sx={{ color: 'white' }} />  // 无用户名：白色图标
    )}
  </Fab>

    {/* 第二个：白色背景 + 蓝色图标（保持不变） */}
  <Fab color="default" onClick={() => setIsSidebarOpen(true)} sx={{ bgcolor: 'white' }}>
    <ContactSupport color="primary" />
  </Fab>


</Box>
            </Zoom>

            {/* 弹窗集合 */}
            <AnimatePresence>
                {(openNameDialog || isSidebarOpen || openDialog) && (
                    <>
                        <Box component={motion.div} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => { if(!loading) { setOpenNameDialog(false); setIsSidebarOpen(false); setOpenDialog(false); } }}
                            sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 20000 }} />

                        {openNameDialog && (
                            <Box component={motion.div}
                                initial={isMobile ? { y: "105%", x: '-50%' } : { opacity: 0, scale: 0.9, y: 20, x: '-50%' }}
                                animate={isMobile ? { y: 0, x: '-50%' } : { opacity: 1, scale: 1, y: 0, x: '-50%' }}
                                exit={isMobile ? { y: "105%", x: '-50%' } : { opacity: 0, scale: 0.9, y: 20, x: '-50%' }}
                                sx={isMobile ? mobileSheetSx : pcModalSx}
                                transition={transitionConfig}
                            >
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography variant="h6" fontWeight="900" color="primary">设置您的署名</Typography>
                                    <IconButton onClick={() => setOpenNameDialog(false)} sx={{ bgcolor: '#f5f5f5' }}><Close fontSize="small" /></IconButton>
                                </Box>
                                <TextField fullWidth autoFocus placeholder="发布贴纸前请先输入署名..." value={username} onChange={e => setUsername(e.target.value)} sx={{ "& .MuiOutlinedInput-root": { borderRadius: '12px', bgcolor: '#f9f9f9' } }} />
                                <Button variant="contained" fullWidth size="large" onClick={() => setOpenNameDialog(false)} sx={{ py: 1.5, borderRadius: '14px', fontWeight: 'bold' }}>确认</Button>
                            </Box>
                        )}

                        {isSidebarOpen && (
                            <Box component={motion.div}
                                initial={isMobile ? { y: "100%", x: '-50%' } : { opacity: 0, scale: 0.9, y: 20, x: '-50%' }}
                                animate={isMobile ? { y: 0, x: '-50%' } : { opacity: 1, scale: 1, y: 0, x: '-50%' }}
                                exit={isMobile ? { y: "100%", x: '-50%' } : { opacity: 0, scale: 0.9, y: 20, x: '-50%' }}
                                sx={isMobile ? mobileSheetSx : pcModalSx}
                                transition={transitionConfig}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography variant="h6" fontWeight="900" color="primary">建议与反馈</Typography>
                                    <IconButton onClick={() => setIsSidebarOpen(false)} sx={{ bgcolor: '#f5f5f5' }}><Close fontSize="small" /></IconButton>
                                </Box>
                                <TextField fullWidth label="如何联系？" value={feedbackContact} onChange={e => setFeedbackContact(e.target.value)} sx={{ "& .MuiOutlinedInput-root": { borderRadius: '12px' } }} />
                                <TextField fullWidth multiline rows={4} label="内容" value={feedbackContent} onChange={e => setFeedbackContent(e.target.value)} sx={{ "& .MuiOutlinedInput-root": { borderRadius: '12px' } }} />
                                    <Box sx={{display: 'flex', gap: 1 , flexDirection: "column"}}>
                                                                      <Typography component="p" color="primary" sx={{fontSize: 14}}> 
                                    Gmail : <Typography component="span" color="secondary" sx={{fontSize: 14}}>huangmiaomiao2025@mail.com</Typography>
                                </Typography>
                                <Typography component="p" color="primary" sx={{fontSize: 14}}> 
                                    Github : <Link sx={{fontSize: 14}} color="secondary" href="https://github.com/HuangCH2024/notia" >https://github.com/HuangCH2024/notia</Link>
                                </Typography>
                                    </Box>
                                <Button variant="contained" fullWidth size="large" onClick={handleFeedbackSubmit} sx={{ py: 1.5, borderRadius: '14px', fontWeight: 'bold' }}>提交</Button>
                            </Box>
                        )}

                        {openDialog && (
                            <Box component={motion.div}
                                initial={isMobile ? { y: "100%", x: '-50%' } : { opacity: 0, scale: 0.9, y: 20, x: '-50%' }}
                                animate={isMobile ? { y: 0, x: '-50%' } : { opacity: 1, scale: 1, y: 0, x: '-50%' }}
                                exit={isMobile ? { y: "100%", x: '-50%' } : { opacity: 0, scale: 0.9, y: 20, x: '-50%' }}
                                sx={isMobile ? mobileSheetSx : pcModalSx}
                                transition={transitionConfig}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography variant="h6" fontWeight="900" color="primary">发布新贴纸</Typography>
                                    <IconButton onClick={() => setOpenDialog(false)} sx={{ bgcolor: '#f5f5f5' }}><Close fontSize="small" /></IconButton>
                                </Box>
                                <TextField fullWidth multiline rows={isMobile ? 3 : 4} placeholder="写点什么..." value={content} onChange={e => setContent(e.target.value)} sx={{ "& .MuiOutlinedInput-root": { borderRadius: '12px', bgcolor: '#f9f9f9' } }} />
                                {!preview ? (
                                    <Button component="label" fullWidth variant="outlined" sx={{ py: 3, borderStyle: 'dashed', borderRadius: '12px' }}>
                                        {loading ? '正在处理图片...' : '+ 上传图片 (不推荐过大的图片)'}
                                        <input type="file" hidden accept="image/*" disabled={loading} onChange={handleImageChange} />
                                    </Button>
                                ) : (
                                    <Box sx={{ position: 'relative' }}>
                                        <Box component="img" src={preview} sx={{ width: '100%', borderRadius: '12px', maxHeight: '200px', objectFit: 'contain', bgcolor: '#f0f0f0' }} />
                                        <IconButton onClick={() => {setPreview(null); setFile(null);}} sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(255,255,255,0.8)' }} size="small">
                                            <Close fontSize="small" />
                                        </IconButton>
                                    </Box>
                                )}
                                <Button variant="contained" fullWidth size="large" onClick={handleSubmit} disabled={loading} sx={{ py: 1.5, borderRadius: '14px', fontWeight: 'bold' }}>
                                    {loading ? '处理中...' : '确认投递'}
                                </Button>
                            </Box>
                        )}
                    </>
                )}
            </AnimatePresence>

            <Snackbar open={showSuccess} autoHideDuration={5000} onClose={() => setShowSuccess(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center'}} sx={{ zIndex: 20003}} TransitionComponent={SlideUp}><Alert severity="success" variant="filled" sx={{ borderRadius: '12px' }}>操作成功！</Alert></Snackbar>
            <Snackbar open={openError} autoHideDuration={5000} onClose={() => setOpenError(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center'}} sx={{ zIndex: 20003}} TransitionComponent={SlideUp}><Alert severity="error" variant="filled" sx={{ borderRadius: '12px'}}>{errorMsg}</Alert></Snackbar>
        </Box>
    );
}