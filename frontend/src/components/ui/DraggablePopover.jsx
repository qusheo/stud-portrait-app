import { useEffect, useRef, useState } from 'react';
import './DraggablePopover.scss';

export default function DraggablePopover({
    open,
    onClose,
    children,
    initialPosition = { x: 0, y: 0 },
    width = 400,
    height = 500,
    onPositionChange,
}) {
    const popoverRef = useRef(null);
    const dragRef = useRef(null);

    const [position, setPosition] = useState({
        x: 0,
        y: 0,
    });

    const prevOpen = useRef(false);

    useEffect(() => {
        if (open && !prevOpen.current) {
            setPosition(initialPosition);
        }

        prevOpen.current = open;
    }, [open]);

    useEffect(() => {
        const handleOutside = (e) => {
            if (
                popoverRef.current &&
                !popoverRef.current.contains(e.target)
            ) {
                onClose?.();
            }
        };

        if (open) {
            document.addEventListener('mousedown', handleOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleOutside);
        };
    }, [open, onClose]);

    const startDrag = (e) => {
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            x: position.x,
            y: position.y,
        };
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', moveDrag);
        document.addEventListener('mouseup', stopDrag);
    };

    const moveDrag = (e) => {
        if (!dragRef.current || !popoverRef.current) return;

        const newX =
            dragRef.current.x +
            e.clientX -
            dragRef.current.startX;

        const newY =
            dragRef.current.y +
            e.clientY -
            dragRef.current.startY;

        const rect = popoverRef.current.getBoundingClientRect();

        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;

        setPosition({
            x: Math.max(0, Math.min(newX, maxX)),
            y: Math.max(0, Math.min(newY, maxY)),
        });
    };

    const stopDrag = () => {
        console.log(position);
        onPositionChange?.(position);
        dragRef.current = null;

        document.removeEventListener('mousemove', moveDrag);
        document.removeEventListener('mouseup', stopDrag);
    };

    if (!open) return null;

    return (
        <div
            ref={popoverRef}
            className="draggable-popover"
            style={{
                left: position.x,
                top: position.y,
                width,
                height,
            }}
        >
            <div
                className="draggable-popover__header"
                onMouseDown={startDrag}
            />

            <div className="draggable-popover__content">
                {children}
            </div>
        </div>
    );
}