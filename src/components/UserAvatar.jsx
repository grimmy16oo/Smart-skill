import { getUserInitials, hasRealAvatar } from "../utils/avatar";

const sizeClasses = {
  xs: "w-7 h-7 text-xs",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-base",
  xl: "w-24 h-24 text-3xl",
  "2xl": "w-32 h-32 text-4xl",
};

export default function UserAvatar({
  user,
  size = "md",
  className = "",
  imageClassName = "",
}) {
  const avatar = user?.avatar;
  const initials = getUserInitials(user);

  return (
    <div
      className={`
        ${sizeClasses[size] || sizeClasses.md}
        relative shrink-0 overflow-hidden rounded-full
        bg-gradient-to-br from-slate-800 via-indigo-600 to-cyan-500
        text-white shadow-sm ring-2 ring-base-100
        flex items-center justify-center font-bold
        ${className}
      `}
      title={user?.email || user?.name || "User avatar"}
    >
      {hasRealAvatar(avatar) ? (
        <img
          src={avatar}
          alt={user?.name || "User"}
          className={`h-full w-full object-cover ${imageClassName}`}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
