import './ZoomControls.css';

interface ZoomControlsProps {
    scale: number;
    onScaleChange: (scale: number) => void;
    onAutoFit: () => void;
}

export function ZoomControls({ scale, onScaleChange, onAutoFit }: ZoomControlsProps) {
    const MIN_SCALE = 0.3;
    const MAX_SCALE = 2.0;
    const STEP = 0.1;

    const handleZoomOut = () => {
        onScaleChange(Math.max(MIN_SCALE, scale - STEP));
    };

    const handleZoomIn = () => {
        onScaleChange(Math.min(MAX_SCALE, scale + STEP));
    };

    const percentage = Math.round(scale * 100);

    return (
        <div className="zoom-controls">
            <button
                className="zoom-btn"
                onClick={handleZoomOut}
                disabled={scale <= MIN_SCALE}
                title="缩小"
            >
                −
            </button>
            <span className="zoom-percentage">{percentage}%</span>
            <button
                className="zoom-btn"
                onClick={handleZoomIn}
                disabled={scale >= MAX_SCALE}
                title="放大"
            >
                +
            </button>
            <button
                className="zoom-btn zoom-fit"
                onClick={onAutoFit}
                title="自适应"
            >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 5V2H5M11 2H14V5M14 11V14H11M5 14H2V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>
        </div>
    );
}
