import { useState } from 'react';
import './Tooltip.scss';

export default function Tooltip({ 
    children, 
    text, 
    placement = 'top' 
}) {
    const [show, setShow] = useState(false);

    return (
        <div 
            className="Tooltip"
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
        >
            {children}

            {show && (
                <div className={`tooltip tooltip-${placement}`}>
                    {text}
                </div>
            )}
        </div>
    );
}