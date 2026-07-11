"use client";

import { useState, useRef, useEffect } from "react";
import { User, Settings } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";

interface UserAvatarProps {
  className?: string;
  dropdownDirection?: "up" | "down";
}

export function UserAvatar({
  className = "",
  dropdownDirection = "down",
}: UserAvatarProps) {
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
        h-9 w-9 animate-pulse
        rounded-full
        bg-[var(--color-surface)]
        ${className}
      `}
      />
    );
  }

  return (
    <div
      ref={dropdownRef}
      className={`relative ${className}`}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex h-9 w-9
          items-center justify-center rounded-full
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
        {user.email ? getInitials(user.email) : <User className="h-4 w-4" />}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          className={`
            absolute z-50
            w-56
            rounded-lg border
            border-[var(--color-border)] bg-[var(--color-surface)]
            py-1 shadow-lg
            ${
              dropdownDirection === "up"
                ? "bottom-full left-0 mb-2 duration-200 animate-in fade-in slide-in-from-bottom-2"
                : "right-0 top-full mt-2 duration-200 animate-in fade-in slide-in-from-top-2"
            }
          `}
        >
          {/* User info */}
          <div className="border-b border-[var(--color-border)] px-4 py-3">
            <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
              {user.email}
            </p>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
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
                flex w-full items-center gap-3 px-4 py-2
                text-sm text-[var(--color-text-primary)]
                transition-colors
                hover:bg-[var(--color-border-light)]
              "
            >
              <Settings className="h-4 w-4 text-[var(--color-text-secondary)]" />
              Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
