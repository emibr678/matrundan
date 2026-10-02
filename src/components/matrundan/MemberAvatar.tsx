import * as React from "react";
import { UserRound } from "lucide-react";
import { avatarImageSrc, isMultiavatarImageToken } from "@/lib/matrundan/avatar";
import { cn } from "@/lib/utils";

type AvatarPerson = {
  name: string;
  avatar?: string | null;
  avatarImage?: string | null;
};

/** Enhetlig render av en medlemsavatar: bild, emoji eller neutral fallback. */
export function MemberAvatar({
  member,
  size = 44,
  className,
}: {
  member: AvatarPerson;
  size?: number;
  className?: string;
}) {
  const fontSize = Math.round(size * 0.55);
  const generated = isMultiavatarImageToken(member.avatarImage);
  const imageSrc = avatarImageSrc(member.avatarImage);
  const emoji = member.avatar && member.avatar.length <= 8 ? member.avatar : null;
  const style: React.CSSProperties = { width: size, height: size, fontSize };

  if (imageSrc) {
    return (
      <img
        src={imageSrc}
        alt=""
        style={style}
        className={cn(
          "shrink-0 rounded-full",
          generated ? "bg-mustard/35 object-contain" : "bg-secondary object-cover",
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
      {emoji ? (
        <span>{emoji}</span>
      ) : (
        <UserRound className="h-[52%] w-[52%] text-muted-foreground" />
      )}
    </div>
  );
}
