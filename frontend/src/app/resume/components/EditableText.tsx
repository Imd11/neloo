/**
 * 可直接编辑的文本组件
 * 支持在简历预览中直接点击编辑文字
 */
import { useCallback } from "react";
import "./EditableText.css";

interface EditableTextProps {
  value: string;
  onChange?: (value: string) => void;
  className?: string;
  tag?: "span" | "p" | "div" | "h1" | "h2" | "h3";
  placeholder?: string;
}

export function EditableText({
  value,
  onChange,
  className,
  tag = "span",
  placeholder = "",
}: EditableTextProps) {
  const Tag = tag;

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLElement>) => {
      if (onChange) {
        const newValue = e.currentTarget.textContent || "";
        if (newValue !== value && newValue !== placeholder) {
          onChange(newValue);
        }
      }
    },
    [onChange, value, placeholder]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        e.currentTarget.blur();
      }
      // Escape 取消编辑
      if (e.key === "Escape") {
        e.currentTarget.textContent = value;
        e.currentTarget.blur();
      }
    },
    [value]
  );

  const handleFocus = useCallback(
    (e: React.FocusEvent<HTMLElement>) => {
      // 选中全部文字，方便用户直接替换
      if (onChange && e.currentTarget.textContent) {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(e.currentTarget);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    },
    [onChange]
  );

  const isEditable = !!onChange;
  const displayValue = value || placeholder;
  const isEmpty = !value && placeholder;

  return (
    <Tag
      className={`${className || ""} ${isEditable ? "editable-text" : ""} ${
        isEmpty ? "is-placeholder" : ""
      }`}
      contentEditable={isEditable}
      suppressContentEditableWarning
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      data-placeholder={placeholder}
    >
      {displayValue}
    </Tag>
  );
}
