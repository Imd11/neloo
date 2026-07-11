import { useRef, useState } from "react";
import "./PhotoUpload.css";

interface PhotoUploadProps {
  value: string;
  onChange: (value: string) => void;
}

export function PhotoUpload({ value, onChange }: PhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (file: File) => {
    setError(null);

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("请选择图片文件");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("图片大小不能超过 5MB");
      return;
    }

    // Convert to base64 for storage
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      onChange(result);
    };
    reader.onerror = () => {
      setError("读取文件失败");
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <div className="photo-upload-container">
      <div
        className={`photo-upload-dropzone ${isDragging ? "dragging" : ""} ${
          value ? "has-photo" : ""
        }`}
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {value ? (
          <div className="photo-preview">
            <img
              src={value}
              alt="头像预览"
            />
            <button
              className="photo-remove-btn"
              onClick={handleRemove}
              title="删除头像"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="photo-upload-placeholder">
            <span className="photo-upload-icon">📷</span>
            <span className="photo-upload-text">点击或拖拽上传头像</span>
            <span className="photo-upload-hint">支持 JPG, PNG (最大 5MB)</span>
          </div>
        )}
      </div>

      {error && <div className="photo-upload-error">{error}</div>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        style={{ display: "none" }}
      />
    </div>
  );
}

export default PhotoUpload;
