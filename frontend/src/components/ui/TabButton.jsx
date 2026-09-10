import './TabButton.scss';
export default function TabButton({ text, onClick, isActive = false }) {
    return (
        <button
            onClick={onClick}
            className={isActive ? 'active' : 'not-active'}
        >
            {text}
        </button>
    );
}
