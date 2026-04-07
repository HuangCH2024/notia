import { memo, useState, useEffect, useRef } from 'react';
import Draggable from 'react-draggable';
import { Box, Typography, Paper } from '@mui/material';
import { motion } from 'framer-motion';

const formatTime = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

const MessageTagComponent = ({ data, onFocus, onStop }: any) => {
    const nodeRef = useRef(null);
    const [position, setPosition] = useState({ x: data.pos_x, y: data.pos_y });
    const isDragging = useRef(false);

    useEffect(() => {
        if (!isDragging.current) {
            setPosition({ x: data.pos_x, y: data.pos_y });
        }
    }, [data.pos_x, data.pos_y]);

    const handleStart = () => {
        isDragging.current = true;
        onFocus(data.id);
    };

    const handleDrag = (_: any, ui: any) => {
        setPosition({ x: ui.x, y: ui.y });
    };

    const handleStop = (_: any, ui: any) => {
        onStop(data.id, ui.x, ui.y);
        setTimeout(() => { isDragging.current = false; }, 1000);
    };

    return (
        <Draggable
            nodeRef={nodeRef}
            position={position}
            onStart={handleStart}
            onDrag={handleDrag}
            onStop={handleStop}
            bounds="parent"
        >
            <Box ref={nodeRef} sx={{ position: 'absolute', zIndex: data.z_index, cursor: 'grab', '&:active': { cursor: 'grabbing' } }}>
                <motion.div 
                    initial={{ opacity: 0, scale: 0.5, y: 40 }} 
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                >
                    <Paper elevation={3} sx={{ p: 2, minWidth: 160, maxWidth: 280, borderRadius: '16px 16px 2px 16px', bgcolor: 'white', border: '1px solid rgba(0,0,0,0.06)', userSelect: 'none' }}>
                        {data.sticker_url && <Box component="img" src={data.sticker_url} sx={{ width: '100%', borderRadius: '10px', mb: 1.5, pointerEvents: 'none' }} />}
                        <Typography variant="body2" sx={{ wordBreak: 'break-word', mb: 1.5, fontWeight: 600 }}>{data.content}</Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', opacity: 0.6 }}>
                            <Typography variant="caption" sx={{ fontWeight: 900, color: 'primary.main' }}>@{data.username}</Typography>
                            <Typography variant="caption">{formatTime(data.created_at)}</Typography>
                        </Box>
                    </Paper>
                </motion.div>
            </Box>
        </Draggable>
    );
};

export const MessageTag = memo(MessageTagComponent);