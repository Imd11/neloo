"use client";

import { useState, useRef, useEffect } from "react";
import { User, Settings } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";

interface UserAvatarProps {
  className?: string;
  dropdownDirection?: "up" | "down";
}

export function UserAvatar({ className = "", dropdownDirection = "down" }: UserAvatarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, loading } = useAuth();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Get user initials for avatar
  const getInitials = (email: string) => {
    const name = email.split("@")[0];
    return name.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div
        className={`
        w-9 h-9 rounded-full
        bg-[var(--color-surface)]
        animate-pulse
        ${className}
      `}
      />
    );
  }

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-9 h-9 rounded-full
          flex items-center justify-center
          text-sm font-medium
          transition-all duration-200
          ${
            isOpen
              ? "ring-2 ring-[var(--color-primary)] ring-offset-2"
              : "hover:ring-2 hover:ring-[var(--color-border)] hover:ring-offset-1"
          }
          bg-[var(--color-avatar-bg)] text-[var(--color-primary)]
        `}
        aria-label="User menu"
      >
        {user.email ? getInitials(user.email) : <User className="w-4 h-4" />}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          className={`
            absolute w-56
            bg-[var(--color-surface)]
            border border-[var(--color-border)]
            rounded-lg shadow-lg
            py-1 z-50
            ${dropdownDirection === "up"
              ? "bottom-full mb-2 left-0 animate-in fade-in slide-in-from-bottom-2 duration-200"
              : "top-full mt-2 right-0 animate-in fade-in slide-in-from-top-2 duration-200"
            }
          `}
        >
          {/* User info */}
          <div className="px-4 py-3 border-b border-[var(--color-border)]">
            <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
              {user.email}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Local guest
            </p>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <button
              onClick={() => {
                setIsOpen(false);
                // TODO: Navigate to settings
              }}
              className="
                w-full flex items-center gap-3 px-4 py-2
                text-sm text-[var(--color-text-primary)]
                hover:bg-[var(--color-border-light)]
                transition-colors
              "
            >
              <Settings className="w-4 h-4 text-[var(--color-text-secondary)]" />
              Settings
            </button>

          </div>
        </div>
      )}
    </div>
  );
}
