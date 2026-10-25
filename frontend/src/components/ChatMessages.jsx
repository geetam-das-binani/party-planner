
import { Bot, User } from "lucide-react";

export default function ChatMessages({ messages }) {
  return (
    <div className="space-y-4">
      {messages.map((message) => {
        const isUser = message.role === "user";

        return (
          <div
            key={message.id}
            className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                isUser
                  ? "bg-slate-900 text-white"
                  : "bg-violet-100 text-violet-700"
              }`}
            >
              {isUser ? <User size={18} /> : <Bot size={18} />}
            </div>

            <div
              className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-6 ${
                isUser
                  ? "bg-slate-900 text-white"
                  : "border bg-white text-slate-700"
              }`}
            >
              {message.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
