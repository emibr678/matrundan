import * as React from "react";
import type { Member } from "@/lib/matrundan/types";
import { cn } from "@/lib/utils";

/**
 * Enhetlig render av en medlemsavatar: emoji som text när den finns,
 * annars profilbild, annars deterministisk emoji-fallback från namnet.
 */
export function MemberAvatar({
  member,
  size = 44,
  className,
}: {
  member: Pick<Member, "name" | "avatar" | "avatarImage">;
  size?: number;
  className?: string;
}) {
  const fontSize = Math.round(size * 0.55);
  const emoji =
    (member.avatar && member.avatar.length <= 4 ? member.avatar : undefined) ??
    fallbackEmoji(member.name);

  const style: React.CSSProperties = {
    width: size,
    height: size,
    fontSize,
  };

  if (member.avatarImage && !member.avatar) {
    return (
      <img
        src={member.avatarImage}
        alt=""
        style={style}
        className={cn(
          "shrink-0 rounded-full object-cover bg-secondary",
          className,
        )}
        loading="lazy"
      />
    );
  }
  return (
    <div
      aria-hidden
      style={style}
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-secondary leading-none",
        className,
      )}
    >
      <span>{emoji}</span>
    </div>
  );
}

function fallbackEmoji(name: string): string {
  const pool = ["🦊", "🐻", "🐝", "🦉", "🐿️", "🦔", "🐧", "🦆", "🐢", "🦩"];
  const key = (name ?? "?").charCodeAt(0) || 0;
  return pool[key % pool.length];
}
